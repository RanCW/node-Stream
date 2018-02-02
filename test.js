// const writeStream=require('./myWriteStream')
//
// const ws=new writeStream('./2.txt',{
//   highWaterMark:3
// })
// for(var i=0;i<10;i++){
//   ws.write('孤傲的山鹰,我们都是好都是好好子'+i+'\r\n','utf8',()=>{
//     console.log('xiel');
//   })
// }
//
//
// // ws.on('open',function () {
// //   console.log('open');
// // })
// ws.on('drain',function () {
//   console.log('drain');
// })
// ws.on('end',function () {
//   console.log('end');
// })
// ws.on('close',function () {
//   console.log('close');
// })

let fs=require('fs');

let rs=fs.createReadStream('2.txt',{
  highWaterMark:3,
  encoding:'utf8'
})
rs.on('readable',()=>{
  console.log(rs.read());
})
// rs.on('data',(data)=>{
//   console.log(data);
// })
