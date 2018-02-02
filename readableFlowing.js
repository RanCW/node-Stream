let EventEmitter = require('events');
let fs = require('fs');
class ReadStream extends EventEmitter {
  constructor(path, options) {
    super(path, options);
    this.path = path;
    this.flags = options.flags || 'r';
    this.mode = options.mode || 0o666;
    this.highWaterMark = options.highWaterMark || 64 * 1024;
    this.pos = this.start = options.start || 0;
    this.end = options.end;
    this.encoding = options.encoding;
    this.flowing = null;
    this.buffer = Buffer.alloc(this.highWaterMark);
    this.open();
    this.on('newListener',(type,listener)=>{
      if(type == 'data'){
        this.flowing = true;
        this.read();
      }
    });
  }
  read(){
    if(typeof this.fd != 'number'){
      return this.once('open',()=>this.read());
    }
    let howMuchToRead = this.end?Math.min(this.end - this.pos + 1,this.highWaterMark):this.highWaterMark;
    fs.read(this.fd,this.buffer,0,howMuchToRead,this.pos,(err,bytes)=>{
      if(err){
        if(this.autoClose)
          this.destroy();
        return this.emit('error',err);
      }
      if(bytes){
        let data = this.buffer.slice(0,bytes);
        this.pos += bytes;
        data = this.encoding?data.toString(this.encoding):data;
        this.emit('data',data);
        if(this.end && this.pos > this.end){
          return this.endFn();
        }else{
          if(this.flowing)
            this.read();
        }
      }else{
        return this.endFn();
      }

    })
  }
  endFn(){
    this.emit('end');
    this.destroy();
  }
  open() {
    fs.open(this.path,this.flags,this.mode,(err,fd)=>{
      if(err){
        if(this.autoClose){
          this.destroy();
          return this.emit('error',err);
        }
      }
      this.fd = fd;
      this.emit('open');
    })
  }
  destroy(){
    fs.close(this.fd,()=>{
      this.emit('close');
    });
  }
  pipe(dest){
    this.on('data',data=>{
      let flag = dest.write(data);
      if(!flag){
        this.pause();
      }
    });
    dest.on('drain',()=>{
      this.resume();
    });
  }
  pause(){
    this.flowing = false;
  }
  resume(){
    this.flowing = true;
    this.read();
  }
}
module.exports = ReadStream;