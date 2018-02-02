let fs = require('fs');
// let ReadStream = require('./readablePause');
let ReadStream = require('./readableFlowing');
let rs = new ReadStream('2.txt',{
  highWaterMark:3,
  encoding:'utf8'
});
// rs.on('readable',function () {
//   let char = rs.read(1);
//   console.log(char);
// });
rs.on('data',function (data) {
  console.log(data);
});