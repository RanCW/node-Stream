let fs=require('fs');
let EventEmiter=require('events');

class MyWriteStream extends EventEmiter{
  constructor(path,options){
    super();
    this.path=path;//路径
    this.flags=options.flags||'w';//模式
    this.encoding=options.encoding||null;//编码格式
    this.fd=options.fd||null;//打开文件的标识位
    this.mode=options.mode||0o666;//写入的mode
    this.autoClose=options.autoClose||true;//是否自动关闭
    this.start=options.start||0;//写入的开始位置
    this.pos=this.start;//写入的标示位置
    this.writing=false;//是否正在写入的标识
    this.highWaterMark=options.highWaterMark||1024*16;
    this.buffers = [];//缓存区
    this.length = 0;//表示缓存区字节的长度

    this.open();
  }
  open(){
    fs.open(this.path,this.flags,this.mode,(err,fd)=>{
      if(err){
        if(this.autoClose){
          this.destroy();
        }
        this.emit('error',err);
        return;
      }
      this.fd=fd;
      this.emit('open');
    })
  }
  write(data,encoding,callback){
    let chunk = Buffer.isBuffer(data)?data:Buffer.from(data,this.encoding);
    let len=chunk.length;
    this.length+=len;
    //判断当前最新的缓存区是否小于最高水位线
    let ret = this.length < this.highWaterMark;
    if (this.writing) {//表示正在向底层写数据，则当前数据必须放在缓存区里
      this.buffers.push({
        chunk,
        encoding,
        callback
      });
    } else {//直接调用底层的写入方法进行写入
      //在底层写完当前数据后要清空缓存区
      this.writing = true;
      this._write(chunk, encoding, () => {this.clearBuffer(),callback&&callback()});
    }
    return ret;
  }
  _write(chunk,encoding,callback){
    if(typeof this.fd != 'number'){
      return this.once('open',()=>this._write(chunk, encoding, callback));
    }
    fs.write(this.fd,chunk,0,chunk.length,this.pos,(err,bytesWrite)=>{
      if(err){
        if(this.autoClose){
          this.destroy();
          this.emit('error',err);
        }
      }
      this.pos += bytesWrite;
      //写入多少字母，缓存区减少多少字节
      this.length -= bytesWrite;
      callback && callback();
    })
  }
  clearBuffer(){
    let data = this.buffers.shift();
    if(data){
      this._write(data.chunk,data.encoding,()=>this.clearBuffer())
    }else{
      this.writing = false;
      //缓存区清空了
      this.emit('drain');
    }
  }
  destroy(){
    fs.close(this.fd,()=>{
      this.emit('end');
      this.emit('close');
    })
  }
}

module.exports=MyWriteStream;