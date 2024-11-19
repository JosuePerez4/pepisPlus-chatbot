const fs = require('fs');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

async function startSock() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexión cerrada, intentando reconectar:', shouldReconnect);
            if (shouldReconnect) {
                startSock();
            } else {
                console.log('El usuario se deslogueó, no se intentará reconectar.');
            }
        } else if (connection === 'open') {
            console.log('Conexión exitosa con WhatsApp 🎉');
        }
    });

    sock.ev.on('messages.upsert', async (msg) => {
        const message = msg.messages[0];
        if (!message.key.fromMe && message.message) {
            const from = message.key.remoteJid;
            const text = message.message.conversation || '';
            
            console.log(`Mensaje de ${from}:`, text);
            const lowerText = text.toLowerCase();

            fs.readFile('pyr.json', 'utf8', async (err, data) => {
                if (err) {
                    console.error('Error al leer el archivo de respuestas:', err);
                    await sock.sendMessage(from, { text: 'Hubo un problema al procesar tu solicitud.' });
                    return;
                }

                const respuestas = JSON.parse(data);

                if (lowerText === 'documento') {
                    // Respuesta específica para "documento"
                    const rutaArchivo = './PEP ING-SISTEMAS.pdf';

                    await sock.sendMessage(from, {
                        document: fs.readFileSync(rutaArchivo), // Leer el archivo PDF
                        mimetype: 'application/pdf',
                        fileName: 'PEP-ING SISTEMAS.pdf' // Nombre con el que se enviará el archivo
                    });
                } else if (lowerText === 'menu') {
                    // Construir y enviar el mensaje sobre el documento primero, seguido del menú
                    const menu = respuestas.menu;
                    let menuText = `${menu.title}\n\n${menu.documento}\n\n`; // Agregar mensaje del documento arriba
                
                    // Agregar las opciones del menú debajo
                    for (const [key, option] of Object.entries(menu.options)) {
                        menuText += `${key}. ${option}\n`;
                    }
                
                    await sock.sendMessage(from, { text: menuText });
                } else {
                    // Responder con la opción correspondiente o mensaje por defecto
                    const respuesta = respuestas[lowerText] || respuestas.hola; // Enviar el mensaje "hola" si no hay respuesta
                    await sock.sendMessage(from, { text: respuesta });
                }
            });
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

startSock().catch(err => console.error('Error al iniciar el bot:', err));