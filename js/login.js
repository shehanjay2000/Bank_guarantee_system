import { auth, firebaseConfigured } from './firebase.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword
} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js';

const loginForm = document.getElementById('login-form');
const passwordInput = document.getElementById('password');
const passwordToggle = document.getElementById('password-toggle');
const formMessage = document.getElementById('form-message');
const submitButton = loginForm.querySelector('[type="submit"]');
const requestedPage = new URLSearchParams(window.location.search).get('next');
const destination = ['index.html', 'report.html'].includes(requestedPage) ? requestedPage : 'index.html';

if (firebaseConfigured) {
  onAuthStateChanged(auth, (user) => {
    if (user) window.location.replace(destination);
  });
} else {
  formMessage.textContent = 'Firebase is not configured yet. Add your Firebase project settings in js/firebase.js.';
}

passwordToggle.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  passwordToggle.textContent = isPassword ? 'Hide' : 'Show';
  passwordToggle.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
  passwordToggle.setAttribute('aria-pressed', String(isPassword));
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!firebaseConfigured) return;

  const email = document.getElementById('email').value.trim();
  const password = passwordInput.value;
  submitButton.disabled = true;
  submitButton.textContent = 'Signing in…';
  formMessage.textContent = '';

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.replace(destination);
  } catch (error) {
    const messages = {
      'auth/invalid-credential': 'Email or password is incorrect.',
      'auth/user-not-found': 'No account was found for that email.',
      'auth/wrong-password': 'Email or password is incorrect.',
      'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
      'auth/network-request-failed': 'Unable to connect. Check your internet connection.'
    };
    formMessage.textContent = messages[error.code] || 'Sign-in failed. Check your details and try again.';
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Sign in <span aria-hidden="true">→</span>';
  }
});

loginForm.addEventListener('input', () => {
  if (firebaseConfigured) formMessage.textContent = '';
});
