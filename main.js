const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');

// keep a global reference of the window object to avoid garbage collection
let mainWindow;

// check if the public directory exists
if (!fs.existsSync(path.join(__dirname, 'public'))) {
  fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
}

// check if the src/components directory exists
if (!fs.existsSync(path.join(__dirname, 'src', 'components'))) {
  fs.mkdirSync(path.join(__dirname, 'src', 'components'), { recursive: true });
}

function createWindow() {
  // create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  // load the index.html file
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'public', 'index.html'),
    protocol: 'file:',
    slashes: true
  }));

  // always open DevTools for debugging during development
  mainWindow.webContents.openDevTools();
  
  // log useful information
  console.log('App directory:', __dirname);
  console.log('Loading HTML from:', path.join(__dirname, 'public', 'index.html'));

  // emitted when the window is closed
  mainWindow.on('closed', () => {
    // dereference the window object
    mainWindow = null;
  });
}

// create window when Electron has finished initialization
app.on('ready', createWindow);

// quit when all windows are closed
app.on('window-all-closed', () => {
  // on macOS applications keep their menu bar active until the user quits explicitly
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // on macOS re-create a window when the dock icon is clicked and no other windows are open
  if (mainWindow === null) {
    createWindow();
  }
});

// handle IPC messages from renderer process
ipcMain.on('app-ready', (event) => {
  console.log('App is ready');
});

// handle errors
ipcMain.on('renderer-error', (event, errorMessage) => {
  console.error('Renderer process error:', errorMessage);
});

// log startup
console.log('Electron app starting...');
