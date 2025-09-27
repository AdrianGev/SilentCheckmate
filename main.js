const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');

// Keep a global reference of the window object to avoid garbage collection
let mainWindow;

// Check if the public directory exists
if (!fs.existsSync(path.join(__dirname, 'public'))) {
  fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
}

// Check if the src/components directory exists
if (!fs.existsSync(path.join(__dirname, 'src', 'components'))) {
  fs.mkdirSync(path.join(__dirname, 'src', 'components'), { recursive: true });
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  // Load the index.html file
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'public', 'index.html'),
    protocol: 'file:',
    slashes: true
  }));

  // Always open DevTools for debugging during development
  mainWindow.webContents.openDevTools();
  
  // Log useful information
  console.log('App directory:', __dirname);
  console.log('Loading HTML from:', path.join(__dirname, 'public', 'index.html'));

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    // Dereference the window object
    mainWindow = null;
  });
}

// Create window when Electron has finished initialization
app.on('ready', createWindow);

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS applications keep their menu bar active until the user quits explicitly
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS re-create a window when the dock icon is clicked and no other windows are open
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle IPC messages from renderer process
ipcMain.on('app-ready', (event) => {
  console.log('App is ready');
});

// Handle errors
ipcMain.on('renderer-error', (event, errorMessage) => {
  console.error('Renderer process error:', errorMessage);
});

// Log startup
console.log('Electron app starting...');
