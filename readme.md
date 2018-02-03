## node.js中流(Stream)的深度剖析

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
   
fs.createReadStream()创建一个可读流[(例如 fs.createReadStream())](http://nodejs.cn/api/fs.html#fs_fs_createreadstream_path_options),可读流其实与可写流很相似,但是可读流事实上工作在下面两种模式之一：flowing 和 paused 。
   * 在 flowing 模式下， 可读流自动从系统底层读取数据，并通过 EventEmitter 接口的事件尽快将数据提供给应用。
   * 在 paused 模式下，必须显式调用 stream.read() 方法来从流中读取数据片段。
   
   
   可读流可以通过下面途径切换到 paused 模式：
   * 如果不存在管道目标（pipe destination），可以通过调用 stream.pause() 方法实现。
   * 如果存在管道目标，可以通过取消 'data' 事件监听，并调用 stream.unpipe() 方法移除所有管道目标来实现。
   
   这里需要记住的重要概念就是，可读流需要先为其提供消费或忽略数据的机制，才能开始提供数据。如果消费机制被禁用或取消，可读流将 尝试 停止生成数据。
   
   注意: 为了向后兼容，取消 'data' 事件监听并 不会 自动将流暂停。同时，如果存在管道目标（pipe destination），且目标状态变为可以接收数据（drain and ask for more data），调用了 stream.pause() 方法也并不保证流会一直 保持 暂停状态。
   
   注意: 如果 Readable 切换到 flowing 模式，且没有消费者处理流中的数据，这些数据将会丢失。 比如， 调用了 readable.resume() 方法却没有监听 'data' 事件，或是取消了 'data' 事件监听，就有可能出现这种情况。
   
##### flowing模式
```javascript
   //flowing 模式下createReadStream的工作代码如下：
   let fs=require('fs');
   let rs=fs.createReadStream('2.txt',{
     highWaterMark:3,
     encoding:'utf8'
   })
   rs.on('data',(data)=>{
     console.log(data);
   })
    
```
其实，flowing模式下的可读流的流程与可读流差异不大，所以，这里就不再画原理分析图了，可以参考上述可写流的原理分析图；手写原理分析完整代码如下：
   
```javascript
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
   
```
   
#####paused 模式
```javascript
   //fs.createReadStream原生api的代码如下：
   let fs=require('fs');
   let rs=fs.createReadStream('2.txt',{
     highWaterMark:3,
     encoding:'utf8'
   })
   rs.on('readable',()=>{
     console.log(rs.read());
   })
     
```
这里主要和flowing模式大同小异，只是这种模式下，读取到的数据会放到数据片段里面先缓存起来，并触发readable事件，再通过read方法来读取已读取到的数据片段。原理解析代码如下：
   
```javascript
    let fs = require('fs');
    let EventEmitter = require('events');
    class ReadStream extends EventEmitter {
      constructor(path, options) {
        super(path, options);
        this.path = path;
        this.highWaterMark = options.highWaterMark || 64 * 1024;
        this.buffer = Buffer.alloc(this.highWaterMark);
        this.flags = options.flags || 'r';
        this.encoding = options.encoding;
        this.mode = options.mode || 0o666;
        this.start = options.start || 0;
        this.end = options.end;
        this.pos = this.start;
        this.autoClose = options.autoClose || true;
        this.bytesRead = 0;
        this.closed = false;
        this.flowing;
        this.needReadable = false;
        this.length = 0;
        this.buffers = [];
        this.on('end', function () {
          if (this.autoClose) {
            this.destroy();
          }
        });
        this.on('newListener', (type) => {
          if (type == 'data') {
            this.flowing = true;
            this.read();
          }
          if (type == 'readable') {
            this.read(0);
          }
        });
        this.open();
      }
      open() {
        fs.open(this.path, this.flags, this.mode, (err, fd) => {
          if (err) {
            if (this.autoClose) {
              this.destroy();
              return this.emit('error', err);
            }
          }
          this.fd = fd;
          this.emit('open');
        });
      }
    
      read(n) {
        if (typeof this.fd != 'number') {
          return this.once('open', () => this.read());
        }
        n = parseInt(n, 10);
        if (n != n) {
          n = this.length;
        }
        if (this.length == 0)
          this.needReadable = true;
        let ret;
        if (0 < n < this.length) {
          ret = Buffer.alloc(n);
          let b;
          let index = 0;
          while (null != (b = this.buffers.shift())) {
            for (let i = 0; i < b.length; i++) {
              ret[index++] = b[i];
              if (index == ret.length) {
                this.length -= n;
                b = b.slice(i + 1);
                this.buffers.unshift(b);
                break;
              }
            }
          }
          if (this.encoding) ret = ret.toString(this.encoding);
        }
        let _read = () => {
          let m = this.end ? Math.min(this.end - this.pos + 1, this.highWaterMark) : this.highWaterMark;
          fs.read(this.fd, this.buffer, 0, m, this.pos, (err, bytesRead) => {
            if (err) {
              return
            }
            let data;
            if (bytesRead > 0) {
              data = this.buffer.slice(0, bytesRead);
              this.pos += bytesRead;
              this.length += bytesRead;
              if (this.end && this.pos > this.end) {
                if (this.needReadable) {
                  this.emit('readable');
                }
                this.emit('end');
              } else {
                this.buffers.push(data);
                if (this.needReadable) {
                  this.emit('readable');
                  this.needReadable = false;
                }
              }
            } else {
              if (this.needReadable) {
                this.emit('readable');
              }
              return this.emit('end');
            }
          })
        }
        if (this.length == 0 || (this.length < this.highWaterMark)) {
          _read(0);
        }
        return ret;
      }
      destroy() {
        fs.close(this.fd, (err) => {
          this.emit('close');
        });
      }
      pause() {
        this.flowing = false;
      }
      resume() {
        this.flowing = true;
        this.read();
      }
      pipe(dest) {
        this.on('data', (data) => {
          let flag = dest.write(data);
          if (!flag) this.pause();
        });
        dest.on('drain', () => {
          this.resume();
        });
        this.on('end', () => {
          dest.end();
        });
      }
    }
    module.exports = ReadStream;
```
   
以上就是个人大致对node中的stream的工作原理理解，欢迎大家多多指正，谢谢！

参考资料：

[Node.js v8.9.3 文档](http://nodejs.cn/api/)
   