document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const loginUsernameInput = document.getElementById('login-username');
    const loginPasswordInput = document.getElementById('login-password');
    const signupUsernameInput = document.getElementById('signup-username');
    const signupPasswordInput = document.getElementById('signup-password');
    const signupConfirmPasswordInput = document.getElementById('signup-confirm-password');
    const loginErrorDiv = document.getElementById('login-error');
    const signupErrorDiv = document.getElementById('signup-error');

    // Redirect if already logged in
    if (localStorage.getItem('token')) {
        window.location.href = 'index.html';
        return;
    }

    const handleLoginSuccess = (data) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.user.username);
        window.location.href = 'index.html';
    };

    // --- Event Listeners ---

    // Signup Form Submission
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            signupErrorDiv.textContent = '';

            const username = signupUsernameInput.value.trim();
            const password = signupPasswordInput.value;
            const confirmPassword = signupConfirmPasswordInput.value;

            if (!username || !password || !confirmPassword) {
                signupErrorDiv.textContent = 'All fields are required.';
                return;
            }

            if (password !== confirmPassword) {
                signupErrorDiv.textContent = 'Passwords do not match.';
                return;
            }

            try {
                const signupResponse = await fetch('/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password }),
                });

                if (!signupResponse.ok) {
                    const errorData = await signupResponse.json();
                    throw new Error(errorData.message || 'An unknown error occurred during signup.');
                }

                // Automatically log the user in after successful signup
                const loginResponse = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password }),
                });

                if (!loginResponse.ok) {
                    throw new Error('Signup successful, but failed to automatically log in.');
                }

                const loginData = await loginResponse.json();
                alert('Sign up successful! You are now logged in.');
                handleLoginSuccess(loginData);

            } catch (error) {
                console.error('Error during signup process:', error);
                signupErrorDiv.textContent = error.message;
            }
        });
    }

    // Login Form Submission
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            loginErrorDiv.textContent = '';

            const username = loginUsernameInput.value.trim();
            const password = loginPasswordInput.value;

            if (!username || !password) {
                loginErrorDiv.textContent = 'Both fields are required.';
                return;
            }

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password }),
                });

                if (response.ok) {
                    const data = await response.json();
                    handleLoginSuccess(data);
                } else {
                    const errorData = await response.json();
                    loginErrorDiv.textContent = errorData.message || 'Invalid credentials.';
                }
            } catch (error) {
                console.error('Error during login:', error);
                loginErrorDiv.textContent = 'Could not connect to the server.';
            }
        });
    }
});
