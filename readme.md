## node.js中流(Stream)的深入理解

   流（stream）在 Node.js 中是处理流数据的抽象接口（abstract interface）。stream 模块提供了基础的 API 。使用这些 API 可以很容易地来构建实现流接口的对象。Node.js 提供了多种流对象。流可以是可读的、可写的，或是可读写的。所有的流都是 EventEmitter 的实例。
   
   Node.js 中有四种基本的流类型：
   * Readable - 可读的流 (例如 fs.createReadStream()).
   * Writable - 可写的流 (例如 fs.createWriteStream()).
   * Duplex - 可读写的流 (例如 net.Socket).
   * Transform - 在读写过程中可以修改和变换数据的 Duplex 流 (例如 zlib.createDeflate()).
   
   接下来让我们一起去看看stream中的流是怎么样来工作的。
   
### 可写流 Writable
   ##### fs.createWriteStream(path[, options])创建一个可写流,对这个不太了解的可以查看[fs.createWriteStream(path[, options])](http://nodejs.cn/api/fs.html#fs_fs_createwritestream_path_options)
   
   ```javascript
    let fs=require('fs');
    let ws=fs.createWriteStream('2.txt',{
      highWaterMark:3
    })
    ws.write('我们都是好孩子，哈哈、、、','utf8',(err)=>{
      if(err){
        console.log(err);
      }
    })
   ```
   那么这样一个可写流究竟是如何实现的呢？我们将通过手写代码来模拟fs.createWriteStream的功能来解析node中可写流的工作原理，下面们将通过一张图解来大概看看我们手写代码有哪些功能点，图片如下：

   ![image](https://raw.githubusercontent.com/RanCW/node-Stream/master/analyse.png)

   通过上面的图解代码的功能也就很明显了，下面我们就一一来实现，首先是创建一个类，构建好一个类的大体骨架：
   ```javascript
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
         this.highWaterMark=options.highWaterMark||1024*16;//每次写入的最大值
         this.buffers = [];//缓存区
         this.length = 0;//表示缓存区字节的长度
     
         this.open();
       }
       open(){
         
       }
       write(){
         
       }
       _write(chunk,encoding,callback){
         
       }
       clearBuffer(){
         
       }
       destroy(){
         
       }
     }
     
     module.exports=MyWriteStream;
   ```
   * open方法
   
   如思维导图所示，open方法的功能主要是打开对应路径的文件与触发open事件，所以对应的代码片段如下：
   ```javascript
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
   ```
   * write方法代码段如下：
   ```javascript
    write(data,encoding,callback){
        let chunk = Buffer.isBuffer(data)?data:Buffer.from(data,this.encoding);
        let len=chunk.length;
        this.length+=len;
        //判断当前最新的缓存区是否小于每次写入的最大值
        let ret = this.length < this.highWaterMark;
        if (this.writing) {//表示正在向文件写数据，则当前数据必须放在缓存区里
          this.buffers.push({
            chunk,
            encoding,
            callback
          });
        } else {//直接调用底层的写入方法进行写入
          //在底层写完当前数据后要清空缓存区
          this.writing = true;
          this._write(chunk, encoding, () => {this.clearBuffer();callback&&callback()});
        }
        return ret;
      }
   ```
   * _write方法如下：
   ```javascript
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
          }else{
              this.pos += bytesWrite;
              //写入多少数据，缓存区减少多少字节
              this.length -= bytesWrite;
              callback && callback();
          }
        })
      }
   ```
   * destroy方法,代码如下：
   ```javascript
      destroy(){
          fs.close(this.fd,()=>{
            this.emit('end');
            this.emit('close');
          })
        }
   ```
   * clearBuffer方法，代码如下：
   ```javascript
    clearBuffer(){
        let data = this.buffers.shift();
        if(data){
          this._write(data.chunk,data.encoding,()=>{this.clearBuffer();data.callback()})
        }else{
          this.writing = false;
          //缓存区清空了
          this.emit('drain');
        }
      }
   ```
   * 最后完整的代码如下：
   ```javascript
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
          this.highWaterMark=options.highWaterMark||1024*16;//每次写入的最大值
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
          //判断当前最新的缓存区是否小于每次写入的最大值
          let ret = this.length < this.highWaterMark;
          if (this.writing) {//表示正在向文件写数据，则当前数据必须放在缓存区里
            this.buffers.push({
              chunk,
              encoding,
              callback
            });
          } else {//直接调用底层的写入方法进行写入
            //在底层写完当前数据后要清空缓存区
            this.writing = true;
            this._write(chunk, encoding, () => {this.clearBuffer();callback&&callback()});
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
            }else{
                this.pos += bytesWrite;
                //写入多少数据，缓存区减少多少字节
                this.length -= bytesWrite;
                callback && callback();
            }
          })
        }
        clearBuffer(){
          let data = this.buffers.shift();
          if(data){
            this._write(data.chunk,data.encoding,()=>{this.clearBuffer();data.callback()})
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
   ```
   ### 可读流 Readable - 可读的流 (例如 fs.createReadStream()).
   
   fs.createReadStream()创建一个可读流[(例如 fs.createReadStream())](http://nodejs.cn/api/fs.html#fs_fs_createreadstream_path_options),