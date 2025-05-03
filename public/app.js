// Función para descargar estilos de Firestore
async function pullStylesFromFirestore() {
    try {
        // Esperar a que Firebase esté inicializado
        if (!window.db) {
            console.log('Esperando a que Firebase se inicialice...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (!window.db) {
                throw new Error('Firebase no se ha inicializado correctamente');
            }
        }

        const stylesDoc = await window.getDoc(window.doc(window.db, 'config', 'styles'));
        if (stylesDoc.exists()) {
            const styles = stylesDoc.data();
            
            // Crear un elemento de enlace para descargar el archivo
            const blob = new Blob([styles.css], { type: 'text/css' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'styles.css';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('Estilos descargados exitosamente');
        } else {
            console.log('No se encontraron estilos en Firestore');
        }
    } catch (error) {
        console.error('Error al descargar los estilos:', error);
    }
}

// Agregar la función al objeto window para poder llamarla desde la consola
window.pullStylesFromFirestore = pullStylesFromFirestore;

// Función para guardar estilos en Firestore
async function pushStylesToFirestore() {
    try {
        // Obtener el contenido del archivo styles.css
        const response = await fetch('styles.css');
        const css = await response.text();

        // Guardar en Firestore
        await window.setDoc(window.doc(window.db, 'config', 'styles'), {
            css: css,
            lastUpdated: new Date()
        });

        console.log('Estilos guardados exitosamente en Firestore');
    } catch (error) {
        console.error('Error al guardar los estilos:', error);
    }
}

// Agregar la función al objeto window
window.pushStylesToFirestore = pushStylesToFirestore;

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const sections = {
        home: document.getElementById('home-section'),
        events: document.getElementById('events-section'),
        members: document.getElementById('members-section'),
        messages: document.getElementById('messages-section'),
        strava: document.getElementById('strava-section'),
        login: document.getElementById('login-section'),
        register: document.getElementById('register-section'),
        addEvent: document.getElementById('add-event-section'),
        addMember: document.getElementById('add-member-section')
    };

    const navLinks = {
        home: document.getElementById('home-link'),
        events: document.getElementById('events-link'),
        members: document.getElementById('members-link'),
        messages: document.getElementById('messages-link'),
        strava: document.getElementById('strava-link'),
        login: document.getElementById('login-link'),
        register: document.getElementById('register-link'),
        addEvent: document.getElementById('event-link'),
        addMember: document.getElementById('member-link')
    };

    const loginForm = document.getElementById('login-form');
    const eventsList = document.getElementById('events-list');
    const membersList = document.getElementById('members-list');
    const registerForm = document.getElementById('register-form');
    const eventForm = document.getElementById('event-form');
    const memberForm = document.getElementById('member-form');
    const messageForm = document.getElementById('message-form');
    const googleLoginBtn = document.getElementById('google-login');
    const stravaConnectBtn = document.getElementById('strava-connect');

    // Initialize
    let currentUser = null;
    let stravaToken = null;
    let currentSection = 'home';

    // Verificar estado de autenticación al cargar la página
    window.onAuthStateChanged(window.auth, async (user) => {
        if (user) {
            currentUser = user;
            // Get user data from Firestore
            const userDoc = await window.getDoc(window.doc(window.db, 'users', user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                updateUIForUser(userData);
            }
            
            // Procesar cualquier código pendiente de Strava
            await processPendingStravaCode();
            
            // For iOS devices, ensure we're on the home section
            if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
                // Force a small delay to ensure the DOM is ready
                setTimeout(() => {
                    showSection('home');
                }, 100);
            } else {
                showSection('home');
            }
        } else {
            currentUser = null;
            showSection('login');
        }
    });

    // Navigation
    Object.entries(navLinks).forEach(([key, link]) => {
        if (link) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                if (key === 'login') {
                    window.signOut(window.auth);
                    showSection('login');
                } else {
                    showSection(key);
                }
            });
        }
    });

    function showSection(sectionName) {
        // Ocultar todas las secciones
        document.querySelectorAll('section').forEach(section => {
            section.classList.add('hidden');
            section.style.display = 'none';
        });

        const currentUser = auth.currentUser;
        const isAdmin = currentUser && currentUser.email === 'antonyzanga@gmail.com';

        // Verificar si el usuario está autenticado
        if (!currentUser && sectionName !== 'login' && sectionName !== 'register') {
            sectionName = 'login';
        }

        // Verificar si el usuario es admin antes de mostrar la sección de mensajes
        if (sectionName === 'messages' && !isAdmin) {
            sectionName = 'home';
        }

        // Mostrar la sección seleccionada
        const section = document.getElementById(`${sectionName}-section`);
        if (section) {
            section.classList.remove('hidden');
            section.style.display = 'block';
        }

        // Actualizar la navegación activa
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeLink = document.getElementById(`${sectionName}-link`);
        if (activeLink) {
            activeLink.classList.add('active');
        }

        // Cargar contenido específico de la sección
        if (sectionName === 'home') {
            if (isAdmin) {
                document.getElementById('messages-link').style.display = 'flex';
                document.getElementById('weekly-plan').style.display = 'none';
            } else {
                document.getElementById('messages-link').style.display = 'none';
                loadWeeklyPlan();
            }
        } else if (sectionName === 'messages' && isAdmin) {
            loadUsers();
        } else if (sectionName === 'strava') {
            checkStravaConnection();
        }
    }

    // Authentication
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const userCredential = await window.signInWithEmailAndPassword(window.auth, email, password);
                currentUser = userCredential.user;
                
                // Get user data from Firestore
                const userDoc = await window.getDoc(window.doc(window.db, 'users', currentUser.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    updateUIForUser(userData);
                }
                
                alert('Inicio de sesión exitoso');
                showSection('home');
            } catch (error) {
                console.error('Error de autenticación:', error);
                alert('Error al iniciar sesión: ' + error.message);
            }
        });
    }

    // Google Login
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', async () => {
            try {
                const result = await window.signInWithPopup(window.auth, window.googleProvider);
                const user = result.user;
                
                // Check if user exists in Firestore
                const userDoc = await window.getDoc(window.doc(window.db, 'users', user.uid));
                
                if (!userDoc.exists()) {
                    // Create new user document if it doesn't exist
                    await window.setDoc(window.doc(window.db, 'users', user.uid), {
                        name: user.displayName || 'Usuario',
                        email: user.email,
                        photoURL: user.photoURL,
                        level: 'Principiante',
                        role: 'member',
                        eventsParticipated: 0,
                        createdAt: new Date(),
                        lastMessageTime: 0
                    });
                } else {
                    // Update user document with latest photo URL
                    await window.updateDoc(window.doc(window.db, 'users', user.uid), {
                        photoURL: user.photoURL
                    });
                }
                
                // Get user data
                const userData = userDoc.exists() ? userDoc.data() : {
                    name: user.displayName || 'Usuario',
                    photoURL: user.photoURL,
                    level: 'Principiante',
                    eventsParticipated: 0
                };
                
                updateUIForUser(userData);
                showSection('home');
            } catch (error) {
                console.error('Error en login con Google:', error);
                alert('Error al iniciar sesión con Google: ' + error.message);
            }
        });
    }

    // Función para verificar la conexión con Strava
    async function checkStravaConnection() {
        try {
            if (!currentUser) return;

            const userDoc = await window.getDoc(window.doc(window.db, 'users', currentUser.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.stravaToken) {
                    // Verificar si el token ha expirado
                    const expiresAt = userData.stravaTokenExpiresAt?.toDate();
                    if (expiresAt && expiresAt > new Date()) {
                        document.getElementById('strava-connect').classList.add('hidden');
                        await loadStravaActivities();
                    } else if (userData.stravaRefreshToken) {
                        // Intentar refrescar el token
                        await refreshStravaToken(userData.stravaRefreshToken);
                    }
                }
            }
        } catch (error) {
            console.error('Error al verificar la conexión con Strava:', error);
        }
    }

    // Función para refrescar el token de Strava
    async function refreshStravaToken(refreshToken) {
        try {
            const response = await fetch('https://www.strava.com/oauth/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    client_id: '127124',
                    client_secret: '50825ee5414cc703024485e972996e8a1fd8131b',
                    refresh_token: refreshToken,
                    grant_type: 'refresh_token'
                })
            });

            if (!response.ok) {
                throw new Error(`Error de Strava: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.access_token) {
                throw new Error('No se recibió el token de acceso de Strava');
            }

            // Calcular tiempo de expiración (6 horas desde ahora)
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 6);
            
            // Guardar token en Firestore con tiempo de expiración
            await window.updateDoc(window.doc(window.db, 'users', currentUser.uid), {
                stravaToken: data.access_token,
                stravaRefreshToken: data.refresh_token,
                stravaTokenExpiresAt: expiresAt,
                stravaConnectedAt: new Date()
            });
            
            // Actualizar la UI
            document.getElementById('strava-connect').classList.add('hidden');
            await loadStravaActivities();
        } catch (error) {
            console.error('Error al refrescar el token de Strava:', error);
            // Si falla el refresh, mostrar el botón de conexión
            document.getElementById('strava-connect').classList.remove('hidden');
        }
    }

    // Firestore Data
    async function loadEvents() {
        try {
            const eventsRef = window.collection(window.db, 'events');
            const q = window.query(eventsRef, window.orderBy('date', 'asc'));
            const eventsSnapshot = await window.getDocs(q);
            
            const eventsList = document.getElementById('events-list');
            if (eventsList) {
                eventsList.innerHTML = '';
                
                eventsSnapshot.forEach(doc => {
                    const event = doc.data();
                    const eventCard = document.createElement('div');
                    eventCard.className = 'event-card';
                    eventCard.innerHTML = `
                        <h3>${event.title}</h3>
                        <p>Fecha: ${new Date(event.date).toLocaleDateString()}</p>
                        <p>Lugar: ${event.location}</p>
                        <p>${event.description}</p>
                        <button onclick="registerForEvent('${doc.id}')">Registrarse</button>
                    `;
                    eventsList.appendChild(eventCard);
                });
            }
        } catch (error) {
            console.error('Error loading events:', error);
        }
    }

    async function registerForEvent(eventId) {
        if (!currentUser) {
            alert('Por favor inicia sesión para registrarte en eventos');
            showSection('login');
            return;
        }

        try {
            await window.db.collection('eventRegistrations').add({
                eventId: eventId,
                userId: currentUser.uid,
                registrationDate: new Date()
            });
            
            // Update user's events participated count
            const userRef = window.db.collection('users').doc(currentUser.uid);
            await window.db.runTransaction(async (transaction) => {
                const userDoc = await transaction.get(userRef);
                const currentCount = userDoc.data().eventsParticipated || 0;
                transaction.update(userRef, { eventsParticipated: currentCount + 1 });
            });
            
            alert('Registro exitoso para el evento');
        } catch (error) {
            console.error('Error registering for event:', error);
            alert('Error al registrarse para el evento');
        }
    }

    async function loadMembers() {
        try {
            const usersRef = window.collection(window.db, 'users');
            const q = window.query(usersRef, window.where('role', '==', 'member'));
            const membersSnapshot = await window.getDocs(q);
            
            const membersList = document.getElementById('members-list');
            if (membersList) {
                membersList.innerHTML = '';
                
                membersSnapshot.forEach(doc => {
                    const member = doc.data();
                    const memberCard = document.createElement('div');
                    memberCard.className = 'member-card';
                    memberCard.innerHTML = `
                        <h3>${member.name}</h3>
                        <p>Edad: ${member.age}</p>
                        <p>Género: ${member.gender}</p>
                        <p>Nivel: ${member.level}</p>
                        <p>Eventos participados: ${member.eventsParticipated || 0}</p>
                    `;
                    membersList.appendChild(memberCard);
                });
            }
        } catch (error) {
            console.error('Error loading members:', error);
        }
    }

    // Update UI for user
    function updateUIForUser(user) {
        const profileIcon = document.getElementById('user-profile-icon');
        const userName = document.getElementById('user-name');
        const adminElements = document.querySelectorAll('.admin-only');
        const weeklyPlanSection = document.getElementById('weekly-plan');
        const messagesLink = document.getElementById('messages-link');
        const loginLink = document.getElementById('login-link');

        if (user) {
            // Actualizar icono de perfil
            if (profileIcon) {
                if (user.photoURL) {
                    profileIcon.src = user.photoURL;
                    profileIcon.style.display = 'block';
                } else {
                    profileIcon.style.display = 'none';
                }
            }

            // Actualizar nombre de usuario
            if (userName) {
                if (user.name) {
                    userName.textContent = user.name;
                    userName.style.display = 'block';
                } else {
                    userName.style.display = 'none';
                }
            }

            // Mostrar/ocultar controles de admin
            const isAdmin = user.email === 'antonyzanga@gmail.com';
            adminElements.forEach(element => {
                if (element) {
                    element.style.display = isAdmin ? 'flex' : 'none';
                }
            });

            // Mostrar/ocultar plan semanal según el usuario
            if (weeklyPlanSection) {
                weeklyPlanSection.style.display = isAdmin ? 'none' : 'block';
            }

            // Actualizar enlace de login/logout
            if (loginLink) {
                const loginIcon = loginLink.querySelector('.nav-icon');
                const loginText = loginLink.querySelector('.nav-text');
                
                if (loginIcon) loginIcon.textContent = '🔒';
                if (loginText) loginText.textContent = 'Cerrar Sesión';
                
                loginLink.onclick = () => {
                    window.signOut(window.auth);
                    return false;
                };
            }
        } else {
            // Usuario no autenticado
            if (profileIcon) {
                profileIcon.style.display = 'none';
            }
            
            if (userName) {
                userName.style.display = 'none';
            }
            
            adminElements.forEach(element => {
                if (element) {
                    element.style.display = 'none';
                }
            });
            
            if (weeklyPlanSection) {
                weeklyPlanSection.style.display = 'none';
            }
            
            if (loginLink) {
                const loginIcon = loginLink.querySelector('.nav-icon');
                const loginText = loginLink.querySelector('.nav-text');
                
                if (loginIcon) loginIcon.textContent = '🔑';
                if (loginText) loginText.textContent = 'Iniciar Sesión';
                
                loginLink.onclick = () => {
                    showSection('login');
                    return false;
                };
            }
        }
    }

    // Load weekly plan for non-admin users
    async function loadWeeklyPlan() {
        try {
            const currentWeekPlan = document.getElementById('current-week-plan');
            const weeklyPlanSection = document.getElementById('weekly-plan');
            
            if (!currentWeekPlan || !weeklyPlanSection) {
                console.error('Elementos del plan semanal no encontrados');
                return;
            }

            if (!currentUser) {
                console.error('No hay usuario autenticado');
                currentWeekPlan.innerHTML = `
                    <div class="message-title">No hay usuario autenticado</div>
                    <div class="message-content">Por favor, inicia sesión para ver tu plan semanal.</div>
                `;
                weeklyPlanSection.style.display = 'block';
                return;
            }

            // Obtener todos los mensajes para el usuario actual
            const messagesRef = window.collection(window.db, 'messages');
            const q = window.query(
                messagesRef,
                window.where('receiverId', '==', currentUser.uid)
            );

            const messagesSnapshot = await window.getDocs(q);
            
            if (!messagesSnapshot.empty) {
                // Encontrar el mensaje más reciente manualmente
                let lastMessage = null;
                let latestTimestamp = 0;
                
                messagesSnapshot.forEach(doc => {
                    const messageData = doc.data();
                    const timestamp = messageData.timestamp;
                    if (timestamp > latestTimestamp) {
                        latestTimestamp = timestamp;
                        lastMessage = messageData;
                    }
                });

                if (lastMessage) {
                    const messageParts = lastMessage.messageText.split('\n\n');
                    const title = messageParts[0];
                    const content = messageParts.slice(1).join('\n\n');

                    currentWeekPlan.innerHTML = `
                        <div class="message-title">${title}</div>
                        <div class="message-content">${content}</div>
                        <div class="message-date">${new Date(lastMessage.timestamp).toLocaleString()}</div>
                    `;
                    weeklyPlanSection.style.display = 'block';
                } else {
                    showNoPlanMessage(currentWeekPlan, weeklyPlanSection);
                }
            } else {
                showNoPlanMessage(currentWeekPlan, weeklyPlanSection);
            }
        } catch (error) {
            console.error('Error al cargar el plan semanal:', error);
            const currentWeekPlan = document.getElementById('current-week-plan');
            const weeklyPlanSection = document.getElementById('weekly-plan');
            
            if (currentWeekPlan && weeklyPlanSection) {
                currentWeekPlan.innerHTML = `
                    <div class="message-title">Error al cargar el plan</div>
                    <div class="message-content">Por favor, intenta recargar la página.</div>
                `;
                weeklyPlanSection.style.display = 'block';
            }
        }
    }

    function showNoPlanMessage(currentWeekPlan, weeklyPlanSection) {
        currentWeekPlan.innerHTML = `
            <div class="message-title">No hay plan semanal disponible</div>
            <div class="message-content">El plan semanal se actualizará pronto.</div>
        `;
        weeklyPlanSection.style.display = 'block';
    }

    // Registration
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('register-name').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const level = document.getElementById('register-level').value;

            try {
                const userCredential = await window.createUserWithEmailAndPassword(window.auth, email, password);
                currentUser = userCredential.user;

                // Create user document in Firestore
                await window.setDoc(window.doc(window.db, 'users', currentUser.uid), {
                    name: name,
                    email: email,
                    level: level,
                    role: 'member',
                    eventsParticipated: 0,
                    createdAt: new Date(),
                    lastMessageTime: 0
                });

                alert('Registro exitoso');
                showSection('login');
            } catch (error) {
                alert('Error en el registro: ' + error.message);
            }
        });
    }

    // Event Management
    function showAddEventForm() {
        document.getElementById('add-event-form').classList.remove('hidden');
    }

    if (eventForm) {
        eventForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('event-title').value;
            const date = document.getElementById('event-date').value;
            const location = document.getElementById('event-location').value;
            const description = document.getElementById('event-description').value;

            try {
                await window.db.collection('events').add({
                    title: title,
                    date: new Date(date),
                    location: location,
                    description: description,
                    createdAt: new Date(),
                    createdBy: currentUser.uid
                });

                alert('Evento creado exitosamente');
                document.getElementById('add-event-form').classList.add('hidden');
                loadEvents();
            } catch (error) {
                alert('Error al crear el evento: ' + error.message);
            }
        });
    }

    // Member Management
    function showAddMemberForm() {
        document.getElementById('add-member-form').classList.remove('hidden');
    }

    if (memberForm) {
        memberForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('member-name').value;
            const age = document.getElementById('member-age').value;
            const gender = document.getElementById('member-gender').value;
            const level = document.getElementById('member-level').value;

            try {
                await window.db.collection('users').add({
                    name: name,
                    age: age,
                    gender: gender,
                    level: level,
                    role: 'member',
                    eventsParticipated: 0,
                    createdAt: new Date(),
                    createdBy: currentUser.uid
                });

                alert('Miembro agregado exitosamente');
                document.getElementById('add-member-form').classList.add('hidden');
                loadMembers();
            } catch (error) {
                alert('Error al agregar el miembro: ' + error.message);
            }
        });
    }

    // Message Management
    function showMessageForm() {
        document.getElementById('message-form').classList.remove('hidden');
        loadRecipients();
    }

    async function loadRecipients() {
        try {
            const membersSnapshot = await window.db.collection('users')
                .where('role', '==', 'member')
                .get();
            
            const recipientSelect = document.getElementById('message-recipient');
            recipientSelect.innerHTML = '<option value="">Seleccionar destinatario</option>';
            
            membersSnapshot.forEach(doc => {
                const member = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = member.name;
                recipientSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading recipients:', error);
        }
    }

    if (messageForm) {
        messageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const recipientId = document.getElementById('message-recipient').value;
            const content = document.getElementById('message-content').value;

            try {
                await window.db.collection('messages').add({
                    senderId: currentUser.uid,
                    receiverId: recipientId,
                    messageText: content,
                    timestamp: new Date(),
                    title: title
                });

                alert('Mensaje enviado exitosamente');
                document.getElementById('message-form').classList.add('hidden');
                loadMessages();
            } catch (error) {
                alert('Error al enviar el mensaje: ' + error.message);
            }
        });
    }

    async function loadMessages() {
        if (!currentUser) {
            console.log('No hay usuario autenticado');
            return;
        }

        try {
            const messagesSnapshot = await window.getDocs(
                window.query(
                    window.collection(window.db, 'messages'),
                    window.where('receiverId', '==', currentUser.uid)
                )
            );

            const messagesList = document.getElementById('messages-list');
            messagesList.innerHTML = '';

            const messages = [];
            messagesSnapshot.forEach(doc => {
                const messageData = doc.data();
                messages.push({
                    ...messageData,
                    id: doc.id
                });
            });

            // Sort messages by timestamp
            messages.sort((a, b) => b.timestamp - a.timestamp);

            // Show only the most recent message
            if (messages.length > 0) {
                const message = messages[0];
                const messageCard = document.createElement('div');
                messageCard.className = 'message-card';
                messageCard.innerHTML = `
                    <div class="message-title">${message.title}</div>
                    <div class="message-content">${message.messageText}</div>
                    <div class="message-date">${new Date(message.timestamp).toLocaleString()}</div>
                `;
                messagesList.appendChild(messageCard);

                // Actualizar lastMessageTime en el documento del usuario
                const userRef = window.doc(window.db, 'users', currentUser.uid);
                await window.updateDoc(userRef, {
                    lastMessageTime: message.timestamp
                });
            } else {
                messagesList.innerHTML = '<p>No hay mensajes disponibles</p>';
            }
        } catch (error) {
            console.error('Error loading messages:', error);
            alert('Error al cargar los mensajes');
        }
    }

    // Strava Integration
    if (stravaConnectBtn) {
        stravaConnectBtn.addEventListener('click', () => {
            connectStrava();
        });
    }

    async function connectStrava() {
        try {
            const redirectUri = 'https://antonyzanga.github.io/AltoVoltajeRunningTeam/';
            const scope = 'read,activity:read_all,activity:read';
            const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=127124&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&approval_prompt=force&scope=${scope}`;

            // Open in new window for desktop, redirect for mobile
            if (window.innerWidth > 768) {
                const popup = window.open(stravaAuthUrl, 'Strava Auth', 'width=600,height=600');
                if (!popup) {
                    throw new Error('El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes para este sitio.');
                }
            } else {
                window.location.href = stravaAuthUrl;
            }
        } catch (error) {
            console.error('Error al conectar con Strava:', error);
            alert('Error al conectar con Strava: ' + error.message);
        }
    }

    // Cache system for best times
    async function updateBestTimesCache(activities) {
        try {
            if (!currentUser) return;

            const userRef = window.doc(window.db, 'users', currentUser.uid);
            const userDoc = await window.getDoc(userRef);
            const userData = userDoc.data();

            // Get current cache or initialize if it doesn't exist
            const currentCache = userData.bestTimesCache || {
                lastUpdated: 0,
                bestTimes: {}
            };

            // Get the date of the last update
            const lastUpdate = new Date(currentCache.lastUpdated);
            
            // Filter activities that are newer than the last update
            const newActivities = activities.filter(activity => 
                new Date(activity.start_date) > lastUpdate
            );

            // If no new activities, return current cache
            if (newActivities.length === 0) {
                return currentCache.bestTimes;
            }

            // Calculate best times from new activities
            const newBestTimes = calculateBestTimes(newActivities);

            // Merge with existing best times
            const mergedBestTimes = { ...currentCache.bestTimes };
            Object.entries(newBestTimes).forEach(([distance, data]) => {
                if (!mergedBestTimes[distance] || data.time < mergedBestTimes[distance].time) {
                    mergedBestTimes[distance] = data;
                }
            });

            // Update cache in Firestore
            await window.updateDoc(userRef, {
                bestTimesCache: {
                    lastUpdated: new Date().getTime(),
                    bestTimes: mergedBestTimes
                }
            });

            return mergedBestTimes;
        } catch (error) {
            console.error('Error updating best times cache:', error);
            return {};
        }
    }

    async function loadStravaActivities() {
        try {
            if (!stravaToken) {
                console.log('No hay token de Strava disponible');
                return;
            }

            // Fetch all activities by making multiple requests
            let allActivities = [];
            let page = 1;
            let hasMore = true;

            while (hasMore) {
                const response = await fetch(`https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=200`, {
                    headers: {
                        'Authorization': `Bearer ${stravaToken}`
                    }
                });
                
                if (!response.ok) {
                    if (response.status === 401) {
                        const userDoc = await window.getDoc(window.doc(window.db, 'users', currentUser.uid));
                        const userData = userDoc.data();
                        if (userData.stravaRefreshToken) {
                            await refreshStravaToken(userData.stravaRefreshToken);
                            return;
                        }
                    }
                    throw new Error(`Error de Strava: ${response.status}`);
                }

                const activities = await response.json();
                if (!Array.isArray(activities)) {
                    throw new Error('Los datos de actividades no son válidos');
                }

                if (activities.length === 0) {
                    hasMore = false;
                } else {
                    allActivities = allActivities.concat(activities);
                    page++;
                }
            }

            const activitiesList = document.getElementById('activities-list');
            const statsContainer = document.getElementById('strava-stats');
            const bestTimesList = document.getElementById('best-times-list');
            
            activitiesList.innerHTML = '';
            statsContainer.innerHTML = '';
            bestTimesList.innerHTML = '';

            // Sort activities by date (newest first) and take the first 3 for recent activities
            const recentActivities = allActivities
                .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
                .slice(0, 3);

            // Display recent activities
            recentActivities.forEach((activity, index) => {
                const activityCard = document.createElement('div');
                activityCard.className = 'activity-card';
                activityCard.style.animationDelay = `${index * 0.1}s`;
                activityCard.onclick = () => window.open(`https://www.strava.com/activities/${activity.id}`, '_blank');
                
                activityCard.innerHTML = `
                    <h3>${activity.name}</h3>
                    <p>Distancia: ${(activity.distance / 1000).toFixed(2)} km</p>
                    <p>Duración: ${formatDuration(activity.elapsed_time)}</p>
                    <p>Fecha: ${new Date(activity.start_date).toLocaleString()}</p>
                    <p>Velocidad promedio: ${(activity.average_speed * 3.6).toFixed(2)} km/h</p>
                `;
                activitiesList.appendChild(activityCard);
            });

            // Calculate and display stats using all activities
            const stats = calculateStats(allActivities);
            const statsHTML = `
                <div class="stat-card" style="animation-delay: 0.1s">
                    <h4>Total Actividades</h4>
                    <p>${stats.totalActivities}</p>
                </div>
                <div class="stat-card" style="animation-delay: 0.2s">
                    <h4>Distancia Total</h4>
                    <p>${(stats.totalDistance / 1000).toFixed(1)} km</p>
                </div>
                <div class="stat-card" style="animation-delay: 0.3s">
                    <h4>Tiempo Total</h4>
                    <p>${formatDuration(stats.totalTime)}</p>
                </div>
                <div class="stat-card" style="animation-delay: 0.4s">
                    <h4>Velocidad Promedio</h4>
                    <p>${stats.averageSpeed.toFixed(1)} km/h</p>
                </div>
            `;
            statsContainer.innerHTML = statsHTML;

            // Update and get best times from cache
            const bestTimes = await updateBestTimesCache(allActivities);
            let bestTimesHTML = '';
            let delay = 0.1;

            // Convert distances to numbers for sorting
            const distanceOrder = {
                '400m': 0.4,
                '½ Milla': 0.8,
                '1km': 1,
                '1 Milla': 1.60934,
                '2 Millas': 3.21868,
                '5km': 5,
                '10km': 10,
                '15km': 15,
                '10 Millas': 16.0934,
                '20km': 20,
                'Media Maratón': 21.0975
            };

            // Sort distances from shortest to longest
            const sortedDistances = Object.keys(bestTimes).sort((a, b) => {
                return distanceOrder[a] - distanceOrder[b];
            });

            sortedDistances.forEach(distance => {
                const data = bestTimes[distance];
                bestTimesHTML += `
                    <div class="best-time-card" style="animation-delay: ${delay}s" onclick="window.open('https://www.strava.com/activities/${data.activityId}', '_blank')">
                        <h4>${distance}</h4>
                        <p>Tiempo: ${formatDuration(data.time)}</p>
                        <p>Ritmo: ${formatPace(data.pace)}</p>
                    </div>
                `;
                delay += 0.1;
            });

            bestTimesList.innerHTML = bestTimesHTML;

        } catch (error) {
            console.error('Error loading Strava activities:', error);
            const activitiesList = document.getElementById('activities-list');
            const statsContainer = document.getElementById('strava-stats');
            const bestTimesList = document.getElementById('best-times-list');
            
            activitiesList.innerHTML = `
                <div class="error-message">
                    <p>Error al cargar las actividades de Strava. Por favor, intenta reconectar tu cuenta.</p>
                    <button id="strava-connect" class="strava-button">
                        <img src="assets/iconostrava.png" alt="Strava" class="strava-icon">
                        Reconectar con Strava
                    </button>
                </div>
            `;
            
            statsContainer.innerHTML = '';
            bestTimesList.innerHTML = '';
        }
    }

    function calculateStats(activities) {
        const stats = {
            totalActivities: activities.length,
            totalDistance: 0,
            totalTime: 0,
            averageSpeed: 0
        };

        activities.forEach(activity => {
            stats.totalDistance += activity.distance;
            stats.totalTime += activity.elapsed_time;
        });

        if (stats.totalActivities > 0) {
            stats.averageSpeed = (stats.totalDistance / stats.totalTime) * 3.6;
        }

        return stats;
    }

    function formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = (seconds % 60).toFixed(2);
        return `${hours}h ${minutes}m ${secs}s`;
    }

    function calculateBestTimes(activities) {
        const distances = {
            '400m': 0.4,
            '½ Milla': 0.8,
            '1km': 1,
            '1 Milla': 1.60934,
            '2 Millas': 3.21868,
            '5km': 5,
            '10km': 10,
            '15km': 15,
            '10 Millas': 16.0934,
            '20km': 20,
            'Media Maratón': 21.0975
        };

        const bestTimes = {};

        activities.forEach(activity => {
            // Validar que la actividad tenga los datos necesarios
            if (!activity.distance || !activity.elapsed_time || !activity.start_date) {
                return; // Saltar esta actividad si falta algún dato
            }

            const activityDistance = activity.distance / 1000; // Convert to km
            const activityTime = activity.elapsed_time;
            const activityPace = activityTime / activityDistance; // seconds per km

            // Validar que la fecha sea válida
            const activityDate = new Date(activity.start_date);
            if (isNaN(activityDate.getTime())) {
                console.error('Fecha inválida en actividad:', activity);
                return;
            }

            Object.entries(distances).forEach(([distanceName, distanceKm]) => {
                if (activityDistance >= distanceKm) {
                    // Calculate time for the specific distance
                    const timeForDistance = (activityTime * distanceKm) / activityDistance;
                    const paceForDistance = timeForDistance / distanceKm;

                    if (!bestTimes[distanceName] || timeForDistance < bestTimes[distanceName].time) {
                        bestTimes[distanceName] = {
                            time: timeForDistance,
                            pace: paceForDistance,
                            activityId: activity.id,
                            date: activity.start_date // Almacenar la fecha original de Strava
                        };
                    }
                }
            });
        });

        return bestTimes;
    }

    function formatPace(secondsPerKm) {
        const minutes = Math.floor(secondsPerKm / 60);
        const seconds = (secondsPerKm % 60).toFixed(2);
        return `${minutes}:${seconds.toString().padStart(5, '0')} min/km`;
    }

    function formatDistance(km) {
        return km.toFixed(2);
    }

    // Load users for admin
    let isLoadingUsers = false;

    async function loadUsers() {
        // Si ya se está cargando, no hacer nada
        if (isLoadingUsers) {
            return;
        }

        try {
            isLoadingUsers = true;
            console.log('Iniciando carga de usuarios...');

            const usersList = document.getElementById('users-list');
            if (!usersList) {
                console.error('Elemento users-list no encontrado');
                return;
            }

            // Limpiar la lista de usuarios antes de cargar
            usersList.innerHTML = '';

            const usersRef = window.collection(window.db, 'users');
            const usersSnapshot = await window.getDocs(usersRef);

            if (usersSnapshot.empty) {
                usersList.innerHTML = '<p>No hay usuarios registrados</p>';
                return;
            }

            // Obtener la hora actual
            const now = new Date().getTime();
            const twelveHoursAgo = now - (12 * 60 * 60 * 1000);

            // Crear la lista de usuarios
            const users = [];
            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                if (userData.email !== 'antonyzanga@gmail.com') {
                    users.push({
                        id: doc.id,
                        data: userData
                    });
                }
            });

            // Ordenar usuarios por email
            users.sort((a, b) => a.data.email.localeCompare(b.data.email));

            // Crear contenedor para la cuadrícula de usuarios
            const usersGrid = document.createElement('div');
            usersGrid.className = 'users-grid';

            // Agregar usuarios al DOM
            users.forEach(user => {
                const userDiv = document.createElement('div');
                userDiv.className = 'user-checkbox';
                
                // Verificar si el usuario tiene un mensaje reciente
                const hasRecentMessage = user.data.lastMessageTime && 
                    user.data.lastMessageTime > twelveHoursAgo;
                
                if (hasRecentMessage) {
                    userDiv.classList.add('recent-message');
                }
                
                userDiv.innerHTML = `
                    <input type="checkbox" id="user-${user.id}" value="${user.id}">
                    <label for="user-${user.id}">${user.data.email}</label>
                `;
                
                userDiv.addEventListener('click', async (e) => {
                    if (e.target.type !== 'checkbox') {
                        const checkbox = userDiv.querySelector('input[type="checkbox"]');
                        checkbox.checked = !checkbox.checked;
                        await loadUserMessage(user.id);
                    }
                });
                
                usersGrid.appendChild(userDiv);
            });

            usersList.appendChild(usersGrid);
            console.log('Lista de usuarios cargada correctamente');
        } catch (error) {
            console.error('Error al cargar usuarios:', error);
            const usersList = document.getElementById('users-list');
            if (usersList) {
                usersList.innerHTML = `
                    <div class="error-message">
                        <p>Error al cargar la lista de usuarios. Por favor, intenta nuevamente.</p>
                        <button onclick="window.loadUsers()">Reintentar</button>
                    </div>
                `;
            }
        } finally {
            isLoadingUsers = false;
        }
    }

    // Función para copiar el mensaje
    function copyMessage() {
        const messageContent = document.querySelector('.message-content');
        if (messageContent) {
            const originalText = messageContent.getAttribute('data-original-text') || messageContent.textContent;
            navigator.clipboard.writeText(originalText)
                .then(() => {
                    const copyButton = document.getElementById('copy-message');
                    if (copyButton) {
                        const originalIcon = copyButton.innerHTML;
                        copyButton.innerHTML = '✓';
                        setTimeout(() => {
                            copyButton.innerHTML = originalIcon;
                        }, 2000);
                    }
                })
                .catch(err => {
                    console.error('Error al copiar el texto:', err);
                });
        }
    }

    // Función para cargar el mensaje del usuario
    async function loadUserMessage(userId) {
        try {
            console.log('Cargando mensaje para el usuario:', userId);
            
            // Asegurarse de que la sección de mensajes esté visible
            showSection('messages');
            
            // Esperar un momento para que el DOM se actualice
            await new Promise(resolve => setTimeout(resolve, 100));
            
            let messageViewer = document.getElementById('message-viewer');
            let selectedMessage = document.getElementById('selected-message');
            let copyButton = document.getElementById('copy-message');
            let deleteButton = document.getElementById('delete-message');

            // Si no existe el visor de mensajes, lo creamos
            if (!messageViewer) {
                messageViewer = document.createElement('div');
                messageViewer.id = 'message-viewer';
                messageViewer.className = 'hidden';
                document.getElementById('messages-section').appendChild(messageViewer);
            }

            // Si no existe el mensaje seleccionado, lo creamos
            if (!selectedMessage) {
                selectedMessage = document.createElement('div');
                selectedMessage.id = 'selected-message';
                selectedMessage.className = 'message-card';
                selectedMessage.innerHTML = `
                    <div class="message-title"></div>
                    <div class="message-content"></div>
                    <div class="message-date"></div>
                `;
                messageViewer.appendChild(selectedMessage);
            }

            // Si no existe el botón de copiar, lo creamos
            if (!copyButton) {
                copyButton = document.createElement('button');
                copyButton.id = 'copy-message';
                copyButton.className = 'btn-primary';
                copyButton.textContent = 'Copiar Mensaje';
                messageViewer.appendChild(copyButton);
            }

            // Si no existe el botón de eliminar, lo creamos
            if (!deleteButton) {
                deleteButton = document.createElement('button');
                deleteButton.id = 'delete-message';
                deleteButton.className = 'btn-primary';
                deleteButton.textContent = 'Eliminar Mensaje';
                messageViewer.appendChild(deleteButton);
            }

            // Obtener todos los mensajes del usuario
            const messagesSnapshot = await window.getDocs(
                window.query(
                    window.collection(window.db, 'messages'),
                    window.where('receiverId', '==', userId)
                )
            );

            // Encontrar el mensaje más reciente
            let lastMessage = null;
            let lastMessageId = null;
            messagesSnapshot.forEach(doc => {
                const messageData = doc.data();
                if (!lastMessage || messageData.timestamp > lastMessage.timestamp) {
                    lastMessage = messageData;
                    lastMessageId = doc.id;
                }
            });

            if (lastMessage) {
                console.log('Mensaje encontrado:', lastMessage);
                
                // Mostrar el visor de mensajes
                messageViewer.classList.remove('hidden');
                
                const titleElement = selectedMessage.querySelector('.message-title');
                const contentElement = selectedMessage.querySelector('.message-content');
                const dateElement = selectedMessage.querySelector('.message-date');
                
                if (titleElement) titleElement.textContent = lastMessage.title || '';
                if (dateElement) dateElement.textContent = new Date(lastMessage.timestamp).toLocaleString();
                
                if (contentElement) {
                    // Guardar el texto original
                    contentElement.setAttribute('data-original-text', lastMessage.messageText);
                    
                    // Dividir el mensaje en párrafos por dobles saltos de línea
                    const paragraphs = lastMessage.messageText
                        .split('\n\n')
                        .map(paragraph => paragraph.trim())
                        .filter(paragraph => paragraph.length > 0);
                    
                    // Limpiar el contenido anterior
                    contentElement.innerHTML = '';
                    
                    // Crear contenedor para los párrafos
                    paragraphs.forEach(paragraph => {
                        if (paragraph.trim()) {
                            const paragraphContainer = document.createElement('div');
                            paragraphContainer.className = 'paragraph-container';
                            
                            const paragraphContent = document.createElement('div');
                            paragraphContent.className = 'paragraph-content';
                            paragraphContent.textContent = paragraph.trim();
                            
                            const copyButton = document.createElement('button');
                            copyButton.className = 'copy-paragraph';
                            copyButton.innerHTML = '<span class="action-icon">📋</span>';
                            
                            copyButton.onclick = () => {
                                navigator.clipboard.writeText(paragraph.trim())
                                    .then(() => {
                                        const originalIcon = copyButton.innerHTML;
                                        copyButton.innerHTML = '✓';
                                        setTimeout(() => {
                                            copyButton.innerHTML = originalIcon;
                                        }, 2000);
                                    })
                                    .catch(err => {
                                        console.error('Error al copiar el texto:', err);
                                    });
                            };
                            
                            paragraphContainer.appendChild(paragraphContent);
                            paragraphContainer.appendChild(copyButton);
                            contentElement.appendChild(paragraphContainer);
                        }
                    });
                }

                // Configurar el botón de copiar general
                copyButton.onclick = () => {
                    const messageContent = selectedMessage.querySelector('.message-content');
                    if (messageContent) {
                        const originalText = messageContent.getAttribute('data-original-text');
                        if (originalText) {
                            navigator.clipboard.writeText(originalText)
                                .then(() => {
                                    const originalIcon = copyButton.innerHTML;
                                    copyButton.innerHTML = '✓';
                                    setTimeout(() => {
                                        copyButton.innerHTML = originalIcon;
                                    }, 2000);
                                })
                                .catch(err => {
                                    console.error('Error al copiar el texto:', err);
                                });
                        }
                    }
                };

                // Configurar el botón de eliminar
                deleteButton.onclick = async () => {
                    if (confirm('¿Estás seguro de que deseas eliminar este mensaje?')) {
                        try {
                            await window.deleteDoc(window.doc(window.db, 'messages', lastMessageId));
                            messageViewer.classList.add('hidden');
                            // Actualizar la lista de usuarios
                            loadUsers();
                        } catch (error) {
                            console.error('Error al eliminar el mensaje:', error);
                            alert('Error al eliminar el mensaje');
                        }
                    }
                };
            } else {
                console.log('No se encontraron mensajes para el usuario');
                messageViewer.classList.add('hidden');
            }
        } catch (error) {
            console.error('Error al cargar el mensaje:', error);
            alert('Error al cargar el mensaje del usuario');
        }
    }

    // Send message to selected users
    async function sendMessageToSelectedUsers(messageText) {
        const selectedUsers = Array.from(document.querySelectorAll('.user-checkbox input:checked'))
            .map(checkbox => ({
                userId: checkbox.value,
                email: checkbox.nextElementSibling.textContent
            }));

        if (selectedUsers.length === 0) {
            alert('Por favor, selecciona al menos un usuario');
            return;
        }

        if (!messageText.trim()) {
            alert('Por favor, escribe un mensaje');
            return;
        }

        const startDate = document.getElementById('week-start').value;
        if (!startDate) {
            alert('Por favor, selecciona un lunes');
            return;
        }

        const monday = new Date(startDate);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        
        const formattedStartDate = formatDate(monday);
        const formattedEndDate = formatDate(sunday);
        const title = `Semana desde ${formattedStartDate} hasta ${formattedEndDate}`;
        const fullMessageText = `${title}\n\n${messageText}`;

        try {
            for (const user of selectedUsers) {
                const timestamp = Date.now();
                
                const message = {
                    senderId: currentUser.uid,
                    receiverId: user.userId,
                    messageText: fullMessageText,
                    timestamp: timestamp,
                    title: title
                };

                await window.addDoc(window.collection(window.db, 'messages'), message);
                
                await window.setDoc(window.doc(window.db, 'lastMessages', user.userId), {
                    messageText: fullMessageText
                });
                
                const userDiv = document.querySelector(`.user-checkbox input[value="${user.userId}"]`).parentElement;
                userDiv.classList.add('recent-message');
                
                await deletePreviousMessages(message);
            }

            document.getElementById('message-text').value = '';
            alert('Mensaje enviado correctamente');
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Error al enviar el mensaje');
        }
    }

    // Delete previous messages
    async function deletePreviousMessages(currentMessage) {
        try {
            const messagesSnapshot = await window.getDocs(
                window.query(
                    window.collection(window.db, 'messages'),
                    window.where('receiverId', '==', currentMessage.receiverId)
                )
            );

            const deletePromises = [];
            messagesSnapshot.forEach(doc => {
                const messageData = doc.data();
                if (messageData.timestamp < currentMessage.timestamp) {
                    deletePromises.push(window.deleteDoc(window.doc(window.db, 'messages', doc.id)));
                }
            });

            await Promise.all(deletePromises);
            console.log('Mensajes anteriores eliminados correctamente');
        } catch (error) {
            console.error('Error deleting previous messages:', error);
        }
    }

    // Función para formatear la fecha como DD/MM/YYYY
    function formatDate(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    // Función para validar que la fecha seleccionada sea lunes
    function validateMonday(date) {
        return date.getDay() === 1;
    }

    // Función para encontrar el próximo lunes
    function findNextMonday(date) {
        const result = new Date(date);
        result.setDate(date.getDate() + (1 + 7 - date.getDay()) % 7);
        return result;
    }

    // Función para encontrar el lunes más cercano (anterior o siguiente)
    function findNearestMonday(date) {
        const today = new Date(date);
        const day = today.getDay();
        
        if (day === 1) return today;
        if (day === 0) {
            today.setDate(today.getDate() + 1);
            return today;
        }
        
        today.setDate(today.getDate() - (day - 1));
        return today;
    }

    // Configurar el input de fecha para solo permitir lunes
    const weekStartInput = document.getElementById('week-start');
    if (weekStartInput) {
        const today = new Date();
        const nextMonday = findNextMonday(today);
        weekStartInput.min = nextMonday.toISOString().split('T')[0];

        const nearestMonday = findNearestMonday(today);
        weekStartInput.value = nearestMonday.toISOString().split('T')[0];

        weekStartInput.addEventListener('change', (e) => {
            const selectedDate = new Date(e.target.value);
            if (!validateMonday(selectedDate)) {
                alert('Por favor, selecciona un lunes');
                e.target.value = '';
            }
        });

        weekStartInput.addEventListener('input', (e) => {
            const selectedDate = new Date(e.target.value);
            if (selectedDate.getDay() !== 1) {
                const nextMonday = findNextMonday(selectedDate);
                e.target.value = nextMonday.toISOString().split('T')[0];
            }
        });
    }

    // Function to fetch and apply styles from Firestore
    async function fetchAndApplyStyles() {
        try {
            const stylesDoc = await window.getDoc(window.doc(window.db, 'config', 'styles'));
            if (stylesDoc.exists()) {
                const styles = stylesDoc.data();
                const styleElement = document.createElement('style');
                styleElement.textContent = styles.css;
                document.head.appendChild(styleElement);
            } else {
                console.log('No styles found in Firestore');
            }
        } catch (error) {
            console.error('Error fetching styles:', error);
        }
    }

    // Call the function when the page loads
    fetchAndApplyStyles();

    // Initialize message functionality
    const sendMessageButton = document.getElementById('send-message');
    const messageInput = document.getElementById('message-text');
    const messagesLink = document.getElementById('messages-link');

    if (sendMessageButton && messageInput) {
        // Handle send button click
        sendMessageButton.addEventListener('click', () => {
            sendMessageToSelectedUsers(messageInput.value);
        });
    }

    if (messagesLink) {
        messagesLink.addEventListener('click', (e) => {
            e.preventDefault();
            showSection('messages');
            loadUsers();
        });
    }

    // Función para manejar el callback de Strava
    async function handleStravaCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const stravaCode = urlParams.get('strava_code');
        
        if (stravaCode) {
            // Verificar si el usuario está autenticado
            if (!currentUser) {
                console.log('Usuario no autenticado, guardando código para procesar más tarde');
                // Guardar el código en localStorage para procesarlo después de la autenticación
                localStorage.setItem('pendingStravaCode', stravaCode);
                return;
            }

            // Limpiar la URL
            window.history.replaceState({}, document.title, window.location.pathname);
            
            try {
                // Intercambiar el código por un token de acceso
                const response = await fetch('https://www.strava.com/oauth/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        client_id: '127124',
                        client_secret: '50825ee5414cc703024485e972996e8a1fd8131b',
                        code: stravaCode,
                        grant_type: 'authorization_code'
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`Error de Strava: ${response.status}`);
                }

                const data = await response.json();
                
                if (!data.access_token) {
                    throw new Error('No se recibió el token de acceso de Strava');
                }

                // Calcular tiempo de expiración (6 horas desde ahora)
                const expiresAt = new Date();
                expiresAt.setHours(expiresAt.getHours() + 6);
                
                // Guardar token en Firestore con tiempo de expiración
                await window.updateDoc(window.doc(window.db, 'users', currentUser.uid), {
                    stravaToken: data.access_token,
                    stravaRefreshToken: data.refresh_token,
                    stravaTokenExpiresAt: expiresAt,
                    stravaConnectedAt: new Date()
                });
                
                // Actualizar la UI
                document.getElementById('strava-connect').classList.add('hidden');
                await loadStravaActivities();
            } catch (error) {
                console.error('Error al procesar el código de autorización:', error);
                alert('Error al conectar con Strava. Por favor, intenta nuevamente.');
            }
        }
    }

    // Función para procesar el código pendiente de Strava
    async function processPendingStravaCode() {
        const pendingCode = localStorage.getItem('pendingStravaCode');
        if (pendingCode && currentUser) {
            try {
                // Exchange code for token
                const response = await fetch('https://www.strava.com/oauth/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        client_id: '127124',
                        client_secret: '50825ee5414cc703024485e972996e8a1fd8131b',
                        code: pendingCode,
                        grant_type: 'authorization_code'
                    })
                });

                if (!response.ok) {
                    throw new Error(`Error de Strava: ${response.status}`);
                }

                const data = await response.json();
                
                if (!data.access_token) {
                    throw new Error('No se recibió el token de acceso de Strava');
                }

                // Save Strava data to Firestore
                await window.setDoc(window.doc(window.db, 'users', currentUser.uid), {
                    stravaId: data.athlete.id,
                    firstname: data.athlete.firstname,
                    lastname: data.athlete.lastname,
                    profile: data.athlete.profile,
                    stravaToken: data.access_token,
                    stravaRefreshToken: data.refresh_token,
                    stravaTokenExpiresAt: new Date(data.expires_at * 1000),
                    stravaConnectedAt: new Date()
                }, { merge: true });

                // Remove pending code
                localStorage.removeItem('pendingStravaCode');
                
                // Update UI
                updateUIForUser({ stravaConnected: true });
                showSection('strava');
                
                // Show success message
                alert('¡Strava conectado exitosamente!');
            } catch (error) {
                console.error('Error al procesar el código pendiente de Strava:', error);
                alert('Error al conectar con Strava: ' + error.message);
            }
        }
    }

    // After successful login
    async function handleLoginSuccess(user) {
        currentUser = user;
        // ... existing code ...

        // Check for pending Strava code
        const pendingStravaCode = localStorage.getItem('pendingStravaCode');
        if (pendingStravaCode) {
            try {
                // Exchange code for token
                const response = await fetch('https://www.strava.com/oauth/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        client_id: '127124',
                        client_secret: '50825ee5414cc703024485e972996e8a1fd8131b',
                        code: pendingStravaCode,
                        grant_type: 'authorization_code'
                    })
                });

                if (!response.ok) {
                    throw new Error(`Error de Strava: ${response.status}`);
                }

                const data = await response.json();
                
                if (!data.access_token) {
                    throw new Error('No se recibió el token de acceso de Strava');
                }

                // Save Strava data to Firestore
                await window.updateDoc(window.doc(window.db, 'users', user.uid), {
                    stravaId: data.athlete.id,
                    firstname: data.athlete.firstname,
                    lastname: data.athlete.lastname,
                    profile: data.athlete.profile,
                    stravaToken: data.access_token,
                    stravaRefreshToken: data.refresh_token,
                    stravaTokenExpiresAt: new Date(data.expires_at * 1000),
                    stravaConnectedAt: new Date()
                }, { merge: true });

                // Update UI to show Strava is connected
                document.getElementById('strava-connect').classList.add('hidden');
                await loadStravaActivities();
                
                // Remove the pending code
                localStorage.removeItem('pendingStravaCode');
            } catch (error) {
                console.error('Error al procesar el código de Strava:', error);
                alert('Error al conectar con Strava. Por favor, intenta nuevamente.');
            }
        }
    }
}); 