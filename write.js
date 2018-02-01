let fs=require('fs');
let ws=fs.createWriteStream('2.txt',{
  highWaterMark:3
})
ws.write('我们都是好孩子，哈哈、、、','utf8',(err)=>{
  if(err){
    console.log(err);
  }
})