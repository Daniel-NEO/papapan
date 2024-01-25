const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // use SSL
    auth: {
        user: 'danielyen0915@gmail.com',
        pass: 'okqk ubzn hkmf jhny'
    }
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.get('/log', (req, res) => {
    res.sendFile(__dirname + '/log.html');
});

io.on('connection', (socket) => {
    console.log('A user connected');

    // Send initial contents of the file
    fs.readFile('output.txt', 'utf8', (err, data) => {
        if (err) throw err;
        socket.emit('fileData', data);
    });

    // Watch for file changes
    fs.watch('output.txt', (eventType, filename) => {
        if (filename) {
            fs.readFile('output.txt', 'utf8', (err, data) => {
                if (err) throw err;
                io.emit('fileData', data);
            });
        }
    });

    fs.readFile('emailCheck.txt', 'utf8', (err, data) => {
        if (err && err.code !== 'ENOENT') { // Handle file not found error separately
            console.error('Error reading emailCheck.txt:', err);
            return;
        }
        socket.emit('emailData', data || '');
    });

    // Watch for file changes
    fs.watch('emailCheck.txt', (eventType, filename) => {
        if (filename) {
            fs.readFile('emailCheck.txt', 'utf8', (err, data) => {
                if (err) {
                    console.error('Error reading emailCheck.txt:', err);
                    return;
                }
                io.emit('emailData', data);
            });
        }
    });

    socket.on('newOrder', (order) => {
        if (order.quantity < 1) {
            console.log('Invalid order: Quantity must be at least 1');
            return;
        }

        getEmailDiscount(order.email, (maxDiscount) => {
            const now = new Date();
            const timestamp = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
            const logEntry = `${timestamp}, Order received from <strong>${order.name}</strong>, quantity: <strong>${order.quantity}</strong>, discount: <strong>${maxDiscount}%</strong>\n`;
            console.log(logEntry);
            fs.writeFileSync('output.txt', logEntry, { flag: 'a+' });
            io.emit('fileData', fs.readFileSync('output.txt', 'utf8'));
        });
    });

    socket.on('clearLog', () => {
        fs.writeFileSync('output.txt', '');
        io.emit('fileData', '');
    });

    socket.on('removeLine', (lineIndex) => {
        fs.readFile('output.txt', 'utf8', (err, data) => {
            if (err) throw err;
            let lines = data.split('\n');
            lines.splice(lineIndex, 1);
            const updatedData = lines.join('\n');
            fs.writeFileSync('output.txt', updatedData);
            io.emit('fileData', updatedData);
        });
    });

    socket.on('validateEmail', (email, confirmID) => {
        if (isValidEmail(email)) {
            isEmailRegistered(email, (registered) => {
                if (!registered) {
                    const id = Math.floor(1000000 + Math.random() * 9000000);
                    console.log(id);
                    // Send email
                    const mailOptions = {
                        from: 'danielyen0915@gmail.com', // sender address
                        to: email, // receiver (use the email variable)
                        subject: 'PapaPan ID conformation', // Subject line
                        html: `<p>Thank you for visiting PapaPan. We're excited to have you on board.</p>
                        <p>To protect your access and benefits, please use your personal ID below with care. This ID ensures that your discount attempts remain exclusively yours:</p>
                        <p><b>${id}</b></p>
                        <p>Please enter this ID in the ID text input, and press VALIDATE EMAIL to start your experiece.</p>
                        <p>You have five attempts to unlock discounts, and even after these attempts are used, you're welcome to continue trying your luck. Please note that scores beyond your attempts will not be recorded.</p>
                        <p>Wishing you the best of luck</p>
                        <p>-Daniel Yen, G12 Entrepreneur Class</p>` // plaintext body
                    };

                    transporter.sendMail(mailOptions, (error, info) => {
                        if (error) {
                            console.log('Error sending email: ', error);
                            socket.emit('emailError', error.message);
                        } else {
                            console.log('Email sent: ' + info.response);
                            socket.emit('idconfirmEmail', { email: email });
                        }
                    });
                    // Email not registered, append it to the file with 5 attempts
                    fs.appendFile('emailCheck.txt', `${email}:5,0*${id}\n`, (err) => {
                        if (err) {
                            console.error('Error writing to emailCheck.txt:', err);
                        }
                    });
                } else {
                    // Email is registered, get the current number of attempts
                    fs.readFile('emailCheck.txt', 'utf8', (err, data) => {
                        if (err) {
                            console.error('Error reading emailCheck.txt:', err);
                            return;
                        }
                        const attempts = data.split('\n').reduce((acc, line) => {
                            const lineEmail = line.substring(0, line.indexOf(':'));
                            const count = line.substring(line.indexOf(':') + 1, line.indexOf(','));
                            if (lineEmail.trim() === email) {
                                acc = parseInt(count.trim(), 10);
                            }
                            return acc;
                        }, 5); // Default to 5 if not found for some reason
                        const maxDiscount = data.split('\n').reduce((acc, line) => {
                            const lineEmail = line.substring(0, line.indexOf(':'));
                            const discount = line.substring(line.indexOf(',') + 1, line.indexOf('*'));
                            if (lineEmail.trim() === email) {
                                acc = parseInt(discount.trim(), 10);
                            }
                            return acc;
                        }, 0); // Default to 0 if not found for some reason
                        const listID = data.split('\n').reduce((acc, line) => {
                            const lineEmail = line.substring(0, line.indexOf(':'));
                            const lineID = line.substring(line.indexOf('*') + 1);
                            if (lineEmail.trim() === email) {
                                acc = parseInt(lineID.trim(), 10);
                            }
                            return acc;
                        }, 0); // Default to 0 if not found for some reason
                        if (listID == confirmID) {
                            socket.emit('emailValidated', { valid: true, remainingAttempts: attempts, maxDiscount: maxDiscount });
                        }
                        else {
                            socket.emit('emailValidated', { valid: false});
                            console.log("ID invalid");
                        }
                    });
                }
            });
        } else {
            socket.emit('emailValidated', { valid: false });
            console.log("Email invalid");
        }
    });

    function isEmailRegistered(email, callback) {
        fs.readFile('emailCheck.txt', 'utf8', (err, data) => {
            if (err && err.code !== 'ENOENT') { // Handle file not found error separately
                console.error('Error reading emailCheck.txt:', err);
                return callback(false);
            }
            const emails = data ? data.split('\n').map(line => line.split(':')[0]) : [];
            callback(emails.includes(email));
        });
    }

    // Function to check if email is valid
    function isValidEmail(email) {
        return /\S+@\S+\.\S+/.test(email);
    }

    socket.on('notifyBallSpawned', (email) => {
        if (isValidEmail(email)) {
            console.log("Email spawned marble");
            getEmailAttempts(email, (attempts, maxDiscount) => {
                if (attempts > 0) {
                    // Decrease attempts by 1
                    attempts--;
                    socket.emit('updateAttempts', { remainingAttempts: attempts, maxDiscount: maxDiscount });
                    if(attempts == 0) {
                        attempts = -1;
                    }
                    saveEmailAttempts(email, attempts, maxDiscount);
                } else {
                    //Do nothing for now
                }
            });
        }
    });

    socket.on('notifyBallHit', (email, percentage) => {
        if (isValidEmail(email)) {
            getEmailAttempts(email, (attempts, maxDiscount) => {
                console.log("Attempts : ",attempts, " Percentage : ",parseInt(percentage));
                if (attempts != 0 && parseInt(percentage) > maxDiscount) {
                    console.log("New Record");
                    maxDiscount = percentage;
                    if(attempts == -1) {
                        attempts = 0;
                    }
                    socket.emit('updateAttempts', { remainingAttempts: attempts, maxDiscount: maxDiscount });
                    saveEmailAttempts(email, attempts, maxDiscount);
                } else {
                    //Do nothing for now
                }
            });
        }
    });
});

function getEmailAttempts(email, callback) {
    fs.readFile('emailCheck.txt', 'utf8', (err, data) => {
        if (err && err.code !== 'ENOENT') {
            console.error('Error reading emailCheck.txt:', err);
            return callback(5, 0); // Default to 5 attempts and 0% discount
        }
        const lines = data.split('\n');
        const line = lines.find(line => line.startsWith(email));
        if (line) {
            console.log(line);
            const attempts = line.substring(line.indexOf(':') + 1, line.indexOf(','));
            const maxDiscount = line.substring(line.indexOf(',') + 1, line.indexOf('*'));
            console.log(attempts, maxDiscount);
            callback(attempts, maxDiscount);
        } else {
            // Email not found, default to 5 attempts and 0% discount
            callback(5, 0);
        }
    });
}

function saveEmailAttempts(email, attempts, maxDiscount) {
    fs.readFile('emailCheck.txt', 'utf8', (err, data) => {
        if (err && err.code !== 'ENOENT') {
            console.error('Error reading emailCheck.txt:', err);
            return;
        }
        let lines = data.split('\n');
        const index = lines.findIndex(line => line.startsWith(email));
        if (index !== -1) {
            // Update the line with the new number of attempts
            lines[index] = `${email}:${attempts},${maxDiscount}*${lines[index].substring(lines[index].indexOf('*') + 1)}`;
        }
        fs.writeFile('emailCheck.txt', lines.join('\n'), (err) => {
            if (err) {
                console.error('Error writing to emailCheck.txt:', err);
            }
        });
    });
}

function getEmailDiscount(email, callback) {
    fs.readFile('emailCheck.txt', 'utf8', (err, data) => {
        if (err && err.code !== 'ENOENT') {
            console.error('Error reading emailCheck.txt:', err);
            return callback(0); // Default discount
        }
        const line = data.split('\n').find(line => line.startsWith(email));
        if (line) {
            const discount = parseInt(line.split(',')[1], 10);
            callback(discount);
        } else {
            callback(0); // Default discount if email not found
        }
    });
}

server.listen(3000, () => {
    console.log('listening on *:3000');
});
