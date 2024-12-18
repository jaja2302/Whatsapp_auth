const socket = io();

socket.on('connect', () => {
  console.log('Connected to server');
  refreshQueueStatus();
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

socket.on('server-log', (logData) => {
  addToLog(logData.message, logData.type);
});
