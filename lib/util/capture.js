module.exports = function(callback, stream) {
    if (!stream) stream = "stdout"
    var old_write = process[stream].write
 
    process[stream].write = (function(write) {
        return function(string, encoding, fd) {
            callback(string, encoding, fd, function(s) {
              write.apply(process[stream], arguments)
            })
        }
    })(process[stream].write)
 
    return function() {
        process[stream].write = old_write
    }
}
