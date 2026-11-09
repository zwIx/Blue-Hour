(function(root){
 function calendar(date=new Date()){
  const day=date.getDay(),minutes=date.getHours()*60+date.getMinutes();
  return {date:`${date.getMonth()+1}/${date.getDate()}`,weekday:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][day],shortDay:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day],weekend:[4,5,6].includes(day),night:minutes>=17*60||minutes<3*60};
 }
 if(typeof module==='object')module.exports=calendar;else root.blueHourCalendar=calendar;
})(globalThis);
