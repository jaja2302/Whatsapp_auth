var Service = require('node-windows').Service;

// Create a new service object
var svc = new Service({
  name:'Bot_da',
  description: 'The nodejs.org bot_da.',
  script: 'C:\\Users\\Digital Architect SR\\Desktop\\bot_da2024\\index.js',
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ]
  //, workingDirectory: '...'
  //, allowServiceLogon: true
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('uninstall',function(){
  console.log('Uninstall complete.');
  console.log('The service exists: ',svc.exists);
});

svc.uninstall();