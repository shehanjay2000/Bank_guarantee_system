import { auth, firebaseConfigured } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js';

if (!firebaseConfigured) {
  window.location.replace('login.html');
} else {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      const returnTo = `${window.location.pathname.split('/').pop()}${window.location.search}`;
      window.location.replace(`login.html?next=${encodeURIComponent(returnTo)}`);
      return;
    }

    document.querySelectorAll('[data-auth-logout]').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await signOut(auth);
          window.location.replace('login.html');
        } catch (error) {
          console.error('Unable to sign out:', error);
          button.disabled = false;
          alert('Sign out failed. Please try again.');
        }
      });
    });
  });
}
