module.exports = (function() {
  var crypto = require('crypto');
  var http = require('http');
  var request = require('request');

  var Pusher = function(options) {
    this.options = options;

    // support appKey being provided instead of key for legacy support
    if( this.options.appKey ) {
      this.options.key = this.options.appKey;
      delete this.options.appKey;
    }

    return this;
  }

  Pusher.prototype = {
    domain: 'api.pusherapp.com',
    scheme: 'http',
    port: 80
  };

  Pusher.prototype.auth = function(socketId, channel, channelData) {
    var returnHash = {}
    var channelDataStr = ''
    if (channelData) {
      channelData = JSON.stringify(channelData);
      channelDataStr = ':' + channelData;
      returnHash['channel_data'] = channelData;
    }
    var stringToSign = socketId + ':' + channel + channelDataStr;
    returnHash['auth'] = this.options.key + ':' + crypto.createHmac('sha256', this.options.secret).update(stringToSign).digest('hex');
    return(returnHash);
  }

  /**
   * Legacy supporting function for fetching a channel object.
   */
  Pusher.prototype.channel = function( channelName ) {
    return new Channel( channelName, this );
  }

  Pusher.prototype.trigger = function(channel, event, message, socketId, callback) {
    if (typeof callback === 'undefined') {
      callback = socketId;
      socketId = '';
    }
    var timestamp = parseInt(new Date().getTime() / 1000);
    var requestBody = JSON.stringify(message);
    var hash = crypto.createHash('md5').update(new Buffer(requestBody).toString('binary')).digest('hex');

    var params = [
      'auth_key=', this.options.key,
      '&auth_timestamp=', timestamp,
      '&auth_version=', '1.0',
      '&body_md5=', hash,
      '&name=', event
    ];
    if (socketId) {
      params.push('&socket_id=', socketId);
    }
    var queryString = params.join('');

    var path = '/apps/' + this.options.appId + '/channels/' + channel + '/events';
    var signData = ['POST', path, queryString].join('\n');
    var signature = crypto.createHmac('sha256', this.options.secret).update(signData).digest('hex');
    path = path + '?' + queryString + '&auth_signature=' + signature;
    var url = this.scheme + '://' + this.domain + ( this.port === 80? '' : ':' + this.port ) + path;
    request.post({
        url: url,
        headers: {
          'content-type': 'application/json'
        },
        body: requestBody
    }, function( err, res, body ) {
      // although new using request module the callback signature
      // needs to be maintained
      callback( err, this.req, res );
    });

    return this;
  }

  /**
   * Channel object used for legacy support. Should not be extended.
   */
  function Channel( channelName, pusher ) {
    this._channelName = channelName;
    this._pusher = pusher;
  }
  /**
   * Trigger an event on a channel.
   */
  Channel.prototype.trigger = function( event, message, callback ) {
    var socketId = null;
    this._pusher.trigger( this.channelName, event, message, socketId, callback );
  };

  return Pusher;
})();