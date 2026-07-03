document.addEventListener('DOMContentLoaded', () => {
    // Connect to Socket.io
    const socket = io();

    // DOM Elements
    const clockEl = document.getElementById('live-clock');
    const valActiveViewers = document.getElementById('val-active-viewers');
    const valActiveAdmins = document.getElementById('val-active-admins');
    const valTotalVisitors = document.getElementById('val-total-visitors');
    const valTotalReservations = document.getElementById('val-total-reservations');
    const valNewReservationsCount = document.getElementById('val-new-reservations-count');
    const activeSocketsSub = document.getElementById('active-sockets-sub');
    const consoleLogs = document.getElementById('console-logs');
    const activeUsersTbody = document.getElementById('active-users-tbody');
    const reservationsTbody = document.getElementById('reservations-tbody');
    const btnRefreshReservations = document.getElementById('btn-refresh-reservations');

    // Live clock update
    function updateClock() {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString();
    }
    setInterval(updateClock, 1000);
    updateClock();

    // Helper to format logs inside the console terminal
    function appendConsoleLog(log) {
        const logLine = document.createElement('div');
        logLine.className = 'console-line';
        
        // Dynamic class based on keywords for color highlighting
        if (log.message.includes('visitor connected') || log.message.includes('connected from')) {
            logLine.classList.add('user-connect');
        } else if (log.message.includes('disconnected')) {
            logLine.classList.add('user-disconnect');
        } else if (log.message.includes('reservation') || log.message.includes('guests')) {
            logLine.classList.add('reservation');
        } else if (log.message.includes('initialised') || log.message.includes('dashboard')) {
            logLine.classList.add('system');
        }

        logLine.textContent = `[${log.timestamp}] ${log.message}`;
        consoleLogs.appendChild(logLine);

        // Auto scroll to bottom
        consoleLogs.scrollTop = consoleLogs.scrollHeight;
    }

    // Helper to format date
    function formatDate(dateStr) {
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        } catch(e) {
            return dateStr;
        }
    }

    // Render reservations table
    function renderReservations(reservations) {
        valTotalReservations.textContent = reservations.length;
        valNewReservationsCount.textContent = `${reservations.length} booked`;
        
        if (reservations.length === 0) {
            reservationsTbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-table">No reservations recorded yet.</td>
                </tr>
            `;
            return;
        }

        // Sort descending by creation date (newest first)
        const sorted = [...reservations].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        reservationsTbody.innerHTML = sorted.map(res => `
            <tr id="row-${res.id}">
                <td><strong>${res.id}</strong></td>
                <td>${escapeHTML(res.name)}</td>
                <td>
                    <div><i class="fa-solid fa-envelope"></i> ${escapeHTML(res.email)}</div>
                    <div><i class="fa-solid fa-phone"></i> ${escapeHTML(res.phone)}</div>
                </td>
                <td>
                    <div><i class="fa-regular fa-calendar"></i> ${formatDate(res.date)}</div>
                    <div><i class="fa-regular fa-clock"></i> ${escapeHTML(res.time)}</div>
                </td>
                <td><span class="badge-page main">${res.guests} Guests</span></td>
                <td><span class="notes-text">${escapeHTML(res.notes) || '<span class="text-muted">None</span>'}</span></td>
                <td>${new Date(res.createdAt).toLocaleTimeString()}</td>
            </tr>
        `).join('');
    }

    // Render active viewers list
    function renderActiveUsers(users) {
        activeSocketsSub.textContent = `${users.length} Connected`;

        if (users.length === 0) {
            activeUsersTbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-table">No active connections.</td>
                </tr>
            `;
            return;
        }

        activeUsersTbody.innerHTML = users.map(user => `
            <tr>
                <td><code style="font-family: var(--font-admin-mono); color: var(--accent-admin-gold);">${user.id}</code></td>
                <td><span class="badge-page ${user.page}">${user.page}</span></td>
                <td><code>${user.ip}</code></td>
                <td><span class="user-agent-str" title="${escapeHTML(user.userAgent)}">${escapeHTML(user.userAgent)}</span></td>
                <td>${user.connectedAt}</td>
            </tr>
        `).join('');
    }

    // Escape HTML to prevent XSS
    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }

    // Fetch reservations manually (on sync or boot)
    function syncReservations() {
        fetch('/api/admin/reservations')
            .then(res => res.json())
            .then(data => {
                renderReservations(data);
            })
            .catch(err => {
                console.error('Error syncing reservations:', err);
            });
    }

    // Socket.io event receivers
    socket.on('admin_init', (data) => {
        // Load initial batch of logs
        consoleLogs.innerHTML = '';
        data.logs.forEach(log => appendConsoleLog(log));
        
        // Load initial batch of reservations
        renderReservations(data.reservations);
    });

    socket.on('stats_update', (stats) => {
        valActiveViewers.textContent = stats.activeViewers;
        valActiveAdmins.textContent = stats.activeAdmins;
        valTotalVisitors.textContent = stats.totalVisitors;
        
        renderActiveUsers(stats.activeUsersList);
    });

    socket.on('log_update', (log) => {
        appendConsoleLog(log);
    });

    socket.on('new_reservation', (reservation) => {
        // Play notification sound if supported (optional/fails silently)
        try {
            const context = new (window.AudioContext || window.webkitAudioContext)();
            const osc = context.createOscillator();
            const gain = context.createGain();
            osc.connect(gain);
            gain.connect(context.destination);
            osc.frequency.setValueAtTime(880, context.currentTime); // A5 note
            gain.gain.setValueAtTime(0.1, context.currentTime);
            osc.start();
            osc.stop(context.currentTime + 0.15);
        } catch(e) {}

        // Re-sync reservations to update table
        syncReservations();
    });

    // Refresh button event listener
    btnRefreshReservations.addEventListener('click', () => {
        syncReservations();
        const syncIcon = btnRefreshReservations.querySelector('i');
        syncIcon.classList.add('fa-spin');
        setTimeout(() => {
            syncIcon.classList.remove('fa-spin');
        }, 1000);
    });
});
