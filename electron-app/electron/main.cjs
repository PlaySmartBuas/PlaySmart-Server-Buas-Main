// const { app, BrowserWindow } = require('electron');
// const path = require('path');

// let mainWindow;

// function createWindow() {
//   mainWindow = new BrowserWindow({
//     width: 1400,
//     height: 900,
//     minWidth: 1200,
//     minHeight: 700,
//     backgroundColor: '#111827',
//     icon: path.join(__dirname, '../public/logo.png'), 
//     webPreferences: {
//       nodeIntegration: false,
//       contextIsolation: true,
//       preload: path.join(__dirname, 'preload.cjs')
//     },
//     titleBarStyle: 'default',
//     show: false,
//     title: 'Breda Guardians Esports Tool',
//   });

//   // Load from dev server in development, built files in production
//   if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
//     mainWindow.loadURL('http://localhost:5173');
//   } else {
//     mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
//   }

//   // Show window when ready
//   mainWindow.once('ready-to-show', () => {
//     mainWindow.show();
//   });

//   mainWindow.on('closed', () => {
//     mainWindow = null;
//   });
// }

// app.whenReady().then(() => {
//   createWindow();

//   app.on('activate', () => {
//     if (BrowserWindow.getAllWindows().length === 0) {
//       createWindow();
//     }
//   });
// });

// app.on('window-all-closed', () => {
//   if (process.platform !== 'darwin') {
//     app.quit();
//   }
// });


const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

// Determine environment
const isDevelopment = process.env.NODE_ENV === 'development' || !app.isPackaged;

// API URL Configuration
const API_URL = isDevelopment 
  ? 'http://localhost:8000'
  : process.env.VITE_API_URL || 'http://localhost:8000';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#111827',
    icon: path.join(__dirname, '../assets/logo.png'), 
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    titleBarStyle: 'default',
    show: false,
    title: 'Breda Guardians Esports Tool',
  });

  // Make API URL available to renderer process
  process.env.VITE_API_URL = API_URL;

  // Log startup information
  console.log('==========================================');
  console.log('🚀 Breda Guardians Esports Tool Starting');
  console.log('==========================================');
  console.log('🔧 Environment:', isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION');
  console.log('🌐 API URL:', API_URL);
  console.log('📦 App Version:', app.getVersion());
  console.log('==========================================');

  // Load from dev server in development, built files in production
  if (isDevelopment) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});