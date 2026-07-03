const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const RESERVATIONS_FILE = path.join(__dirname, 'reservations.json');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory stats
let totalVisitors = 0;
const activeUsers = new Map(); // socket.id -> { page, ip, userAgent, connectedAt }
let recentLogs = [];

// Helper to add system logs for admin dashboard
function addLog(message) {
    const logEntry = {
        timestamp: new Date().toLocaleTimeString(),
        message: message,
        id: Math.random().toString(36).substr(2, 9)
    };
    recentLogs.push(logEntry);
    if (recentLogs.length > 50) {
        recentLogs.shift();
    }
    // Broadcast log and stats update to admin connections
    io.to('admins').emit('log_update', logEntry);
    broadcastStats();
}

// Broadcast updated visitor stats to admins
function broadcastStats() {
    let mainViewers = 0;
    let adminViewers = 0;
    const usersList = [];

    activeUsers.forEach((user, id) => {
        if (user.page === 'main') mainViewers++;
        else if (user.page === 'admin') adminViewers++;
        
        usersList.push({
            id: id.substring(0, 5), // Obfuscated ID for privacy/cleanliness
            page: user.page,
            ip: user.ip,
            userAgent: user.userAgent,
            connectedAt: user.connectedAt
        });
    });

    io.to('admins').emit('stats_update', {
        activeViewers: mainViewers,
        activeAdmins: adminViewers,
        totalVisitors: totalVisitors,
        activeUsersList: usersList
    });
}

// Retrieve reservations
function getReservations() {
    try {
        if (!fs.existsSync(RESERVATIONS_FILE)) {
            fs.writeFileSync(RESERVATIONS_FILE, JSON.stringify([], null, 2));
            return [];
        }
        const data = fs.readFileSync(RESERVATIONS_FILE, 'utf8');
        return JSON.parse(data || '[]');
    } catch (error) {
        console.error('Error reading reservations file:', error);
        return [];
    }
}

// Save reservation
function saveReservation(reservation) {
    try {
        const reservations = getReservations();
        reservations.push(reservation);
        fs.writeFileSync(RESERVATIONS_FILE, JSON.stringify(reservations, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving reservation:', error);
        return false;
    }
}

// Routes
// Serve Admin Dashboard specifically
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Reservation API Endpoint
app.post('/api/reserve', (req, res) => {
    const { name, email, phone, date, time, guests, notes } = req.body;
    
    if (!name || !email || !phone || !date || !time || !guests) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const reservation = {
        id: 'RES-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
        name,
        email,
        phone,
        date,
        time,
        guests: parseInt(guests),
        notes: notes || '',
        createdAt: new Date().toISOString()
    };

    if (saveReservation(reservation)) {
        addLog(`New table reservation created for ${name} (${guests} guests) on ${date} at ${time}`);
        // Notify admin sockets about the new reservation
        io.to('admins').emit('new_reservation', reservation);
        return res.status(200).json({ success: true, message: 'Reservation confirmed successfully!' });
    } else {
        return res.status(500).json({ success: false, message: 'Failed to record reservation. Please try again.' });
    }
});

// Admin API to fetch existing reservations
app.get('/api/admin/reservations', (req, res) => {
    res.json(getReservations());
});

// Socket.io Events
io.on('connection', (socket) => {
    // Determine page client is visiting based on referer
    const referer = socket.handshake.headers.referer || '';
    const isAdmin = referer.includes('/admin');
    const page = isAdmin ? 'admin' : 'main';
    
    // Simple client info
    const userAgent = socket.handshake.headers['user-agent'] || 'Unknown Browser';
    let ip = socket.handshake.address || '127.0.0.1';
    if (ip.startsWith('::ffff:')) {
        ip = ip.substring(7);
    }
    
    // Add to active users
    activeUsers.set(socket.id, {
        page,
        ip,
        userAgent: userAgent.split(') ')[0].replace(/[()]/g, '').substring(0, 40) + '...', // Clean browser string
        connectedAt: new Date().toLocaleTimeString()
    });

    if (page === 'main') {
        totalVisitors++;
        addLog(`New visitor connected from IP: ${ip}`);
    } else {
        socket.join('admins');
        addLog(`Administrator dashboard session opened`);
        
        // Send initial bootstrap info to the admin
        socket.emit('admin_init', {
            logs: recentLogs,
            reservations: getReservations()
        });
    }

    // Always update active admin screens immediately
    broadcastStats();

    // Handle disconnecting
    socket.on('disconnect', () => {
        const user = activeUsers.get(socket.id);
        if (user) {
            activeUsers.delete(socket.id);
            if (user.page === 'main') {
                addLog(`Visitor disconnected from IP: ${user.ip}`);
            } else {
                addLog(`Administrator dashboard session closed`);
            }
            broadcastStats();
        }
    });
});

// Start Server
server.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`  Lovely Cafe backend running on port ${PORT}`);
    console.log(`  Access Main Site: http://localhost:${PORT}`);
    console.log(`  Access Admin Dashboard: http://localhost:${PORT}/admin`);
    console.log(`==================================================`);
});
