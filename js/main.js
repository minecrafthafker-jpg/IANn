// main.js: klientseitige UI + Firebase example (Firestore)
(function(){
  // init firebase if config provided
  if(window.firebaseConfig){
    try{
      firebase.initializeApp(window.firebaseConfig);
      window.db = firebase.firestore();
      console.log('Firebase initialisiert');
    }catch(e){
      console.warn('Firebase init fehlgeschlagen', e);
    }
  }

  const form = document.getElementById('contactForm');
  const status = document.getElementById('formStatus');

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const data = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      message: form.message.value.trim(),
      createdAt: new Date().toISOString()
    };

    status.textContent = 'Sende...';

    if(window.db){
      try{
        await window.db.collection('contacts').add(data);
        status.textContent = 'Danke — Nachricht gesendet!';
        form.reset();
      }catch(err){
        console.error(err);
        status.textContent = 'Fehler beim Senden. Schau in die Konsole.';
      }
    } else {
      // Fallback: log to console if Firebase not configured
      console.log('Kontakt (lokal):', data);
      status.textContent = 'Testmodus: Nachricht lokal geloggt. Firebase nicht konfiguriert.';
      form.reset();
    }
  });
})();
