## node.js中流(Stream)的深入理解

   流（stream）在 Node.js 中是处理流数据的抽象接口（abstract interface）。stream 模块提供了基础的 API 。使用这些 API 可以很容易地来构建实现流接口的对象。Node.js 提供了多种流对象。流可以是可读的、可写的，或是可读写的。所有的流都是 EventEmitter 的实例。
   
   Node.js 中有四种基本的流类型：
   * Readable - 可读的流 (例如 fs.createReadStream()).
   * Writable - 可写的流 (例如 fs.createWriteStream()).
   * Duplex - 可读写的流 (例如 net.Socket).
   * Transform - 在读写过程中可以修改和变换数据的 Duplex 流 (例如 zlib.createDeflate()).
   
   接下来让我们一起去看看stream中的流是怎么样来工作的。
   
### 可写流 Writable
   ##### fs.createWriteStream(path[, options])创建一个可写流,对这个不太了解的可以查看[fs.createWriteStream(path[, options])](http://nodejs.cn/api/fs.html#fs_fs_createwritestream_path_options),这里对官方API就不再描述了。
   
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
   那么这样一个可写流究竟是如何实现的呢？下面们将通过代码来一一说明
   
   