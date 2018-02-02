let fs = require('fs');
let ReadStream = require('./readable');
let rs = new ReadStream('1.txt',{
  highWaterMark:3,
  encoding:'utf8'
});
//在真实的情况下，当可读流创建后会立刻进行暂停模式。其实会立刻填充缓存区
//缓存区大小是可以看到
rs.on('readable',function () {
  console.log(rs.length);//3
  //当你消费掉一个字节之后，缓存区变成2个字节了
  let char = rs.read(1);
  console.log(char);
  console.log(rs.length);
  //一旦发现缓冲区的字节数小于最高水位线了，则会现再读到最高水位线个字节填充到缓存区里
  setTimeout(()=>{
    console.log(rs.length);//5
  },500)
});