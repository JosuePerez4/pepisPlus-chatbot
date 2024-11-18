const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

async function startSock() {
    // Cargar las credenciales desde el directorio './auth_info'
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

    // Crear el socket
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true // Muestra el código QR en la terminal para autenticar
    });

    // Manejador de eventos de conexión
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexión cerrada, intentando reconectar:', shouldReconnect);
            if (shouldReconnect) {
                startSock(); // Reintenta la conexión
            } else {
                console.log('El usuario se deslogueó, no se intentará reconectar.');
            }
        } else if (connection === 'open') {
            console.log('Conexión exitosa con WhatsApp 🎉');
        }
    });

    // Manejador de eventos para nuevos mensajes
    sock.ev.on('messages.upsert', async (msg) => {
        const message = msg.messages[0];
        if (!message.key.fromMe && message.message) {
            const from = message.key.remoteJid;
            const text = message.message.conversation || '';
            
            console.log(`Mensaje de ${from}:`, text);

            // Sistema de comandos básico
            if (text.toLowerCase() === 'Hola') {
                await sock.sendMessage(from, { text: 'Selecciona una opción:\n1. Info 📄\n2. Chiste 🤣\n3. Estado 🏷️' });
            } else if (text === '1') {
                await sock.sendMessage(from, { text: '¡Soy un bot de WhatsApp listo para ayudarte! 🤖' });
            } else if (text === '2') {
                await sock.sendMessage(from, { text: '¿Por qué los programadores odian la naturaleza? Porque tiene demasiados bugs 🐛😆' });
            } else if (text === '3') {
                await sock.sendMessage(from, { text: 'Todo está funcionando perfectamente 🟢' });
            } else {
                await sock.sendMessage(from, { text: 'No entiendo ese comando. Escribe *menu* para ver las opciones.' });
            }
        }
    });

    // Guardar las credenciales cada vez que cambien
    sock.ev.on('creds.update', saveCreds);
}

// Llamar a la función startSock para iniciar el bot
startSock().catch(err => console.error('Error al iniciar el bot:', err));