"""Isolated spotDL adapter. One JSON request in, newline-delimited events out."""
import json, os, sys, pathlib, contextlib, re, tempfile, shutil
wire = sys.stdout

def emit(kind, **fields):
    wire.write(json.dumps({'type': kind, **fields}, default=str) + '\n')
    wire.flush()

try:
    request = json.load(sys.stdin)
    cache = pathlib.Path(os.environ['BLUE_HOUR_CACHE'])
    cache.mkdir(parents=True, exist_ok=True)
    # Keep this worker's third-party caches inside Blue Hour's application data.
    pathlib.Path.home = classmethod(lambda cls: cache)
    with contextlib.redirect_stdout(sys.stderr):
        from spotdl import Spotdl
        from spotdl.types.song import Song
        from spotdl.utils.config import DEFAULT_CONFIG
        if request['mode'] == 'resolve' and '/album/' in request['url']:
            # The public embed contains the complete album track list and avoids
            # spotDL's slow duplicate album API calls. Fall back for other links.
            import requests
            album_id = request['url'].split('/album/')[1].split('?')[0]
            response = requests.get('https://open.spotify.com/embed/album/' + album_id, timeout=25)
            response.raise_for_status()
            match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', response.text, re.S)
            if not match:
                raise RuntimeError('Spotify did not return album metadata. Try again later.')
            entity = json.loads(match.group(1))['props']['pageProps']['state']['data']['entity']
            entries = entity.get('trackList', [])
            if not entries:
                raise RuntimeError('This album has no available tracks.')
            images = entity.get('visualIdentity', {}).get('image', [])
            cover = max(images, key=lambda image: image.get('maxWidth', 0)).get('url') if images else None
            songs = []
            for index, entry in enumerate(entries):
                track_id = entry['uri'].split(':')[-1]
                artists = entry.get('subtitle', entity.get('subtitle', 'Unknown artist')).split(', ')
                songs.append(Song.from_missing_data(name=entry['title'], artists=artists, artist=artists[0], genres=[],
                    disc_number=1, disc_count=1, album_name=entity.get('name', entity['title']),
                    album_artist=entity.get('subtitle', artists[0]), duration=round(entry['duration']/1000),
                    track_number=index+1, tracks_count=len(entries), song_id=track_id, explicit=entry.get('isExplicit', False),
                    publisher='', url='https://open.spotify.com/track/'+track_id, cover_url=cover, album_id=album_id,
                    album_type='album', list_name=entity.get('name'), list_url=request['url'], list_position=index+1, list_length=len(entries)).json)
            emit('songs', songs=songs)
            sys.exit(0)
        staging = pathlib.Path(tempfile.mkdtemp(prefix='download-', dir=cache))
        engine = Spotdl(client_id=DEFAULT_CONFIG['client_id'], client_secret=DEFAULT_CONFIG['client_secret'], headless=True,
            downloader_settings={'ffmpeg': request['ffmpeg'], 'output': str(staging / '{artists} - {title}.{output-ext}'),
                'format': 'mp3', 'threads': 1, 'lyrics': [], 'simple_tui': True, 'overwrite': 'skip', 'yt_dlp_args': '--js-runtimes deno --socket-timeout 30 --retries 3'})
        if request['mode'] == 'resolve':
            songs = engine.search([request['url']])
            emit('songs', songs=[song.json for song in songs])
        else:
            engine.downloader.progress_handler.update_callback = lambda tracker, message: emit('progress', percent=tracker.progress)
            metadata = request['song'].copy()
            for field in ['date', 'isrc', 'publisher', 'copyright_text']:
                if metadata.get(field) is None:
                    metadata[field] = ''
            song, output = engine.download(Song.from_dict(metadata))
            if output is None:
                raise RuntimeError('; '.join(engine.downloader.errors) or 'No matching audio could be downloaded. Try again later.')
            if not pathlib.Path(output).is_file():
                raise RuntimeError('The download finished without an audio file.')
            destination = pathlib.Path(request['output']) / pathlib.Path(output).name
            destination.parent.mkdir(parents=True, exist_ok=True)
            if destination.exists():
                from mutagen.id3 import ID3
                try:
                    same_song = str(ID3(destination).get('WOAS', '')) == song.url
                except Exception:
                    same_song = False
                if not same_song:
                    destination = destination.with_stem(destination.stem + ' [' + song.song_id + ']')
            temporary = destination.with_suffix(destination.suffix + '.bluehour-part')
            shutil.copyfile(output, temporary)
            os.replace(temporary, destination)
            emit('done', path=str(destination))
        shutil.rmtree(staging, ignore_errors=True)
except Exception as exc:
    if 'staging' in locals():
        shutil.rmtree(staging, ignore_errors=True)
    emit('error', message=str(exc)[:600])
    sys.exit(1)
