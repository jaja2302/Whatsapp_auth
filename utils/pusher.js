const Pusher = require('pusher-js/node');
const pusher = new Pusher('b193dcd8922273835547', {
  cluster: 'ap1',
  encrypted: true,
});
const channel = pusher.subscribe('my-channel');
const channelPython = pusher.subscribe('operator-missing');

module.exports = { channel, channelPython };
