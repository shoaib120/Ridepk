// =====================================================================
//  driver.js — Driver Registration Form Logic
//  ALL 6 documents are REQUIRED before submission
// =====================================================================

let currentFStep = 1;
let selectedVtype = 'car';

// Track which files have been uploaded
const uploadedFiles = {
  'cnic-front': false,
  'cnic-back':  false,
  'license':    false,
  'vehicle-reg':false,
  'photo':      false,
  'vehicle-photo': false
};

const uploadLabels = {
  'cnic-front':    'CNIC Front',
  'cnic-back':     'CNIC Back',
  'license':       'Driving License',
  'vehicle-reg':   'Vehicle Registration',
  'photo':         'Your Photo',
  'vehicle-photo': 'Vehicle Photo'
};

// ===== STEP NAVIGATION =====
function goFStep(n) {
  if (n > currentFStep && !validateFStep(currentFStep)) return;

  ['fsec1','fsec2','fsec3'].forEach(id => document.getElementById(id).classList.add('hidden'));
  document.getElementById('fsec' + n).classList.remove('hidden');
  currentFStep = n;

  ['fs1','fs2','fs3'].forEach((id, i) => {
    const el = document.getElementById(id);
    el.classList.remove('active','done');
    if (i + 1 < n)  el.classList.add('done');
    if (i + 1 === n) el.classList.add('active');
  });

  document.querySelector('.dform-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===== VALIDATION =====
function validateFStep(step) {
  if (step === 1) {
    const name     = document.getElementById('fullname').value.trim();
    const phone    = document.getElementById('phone').value.trim();
    const cnic     = document.getElementById('cnic').value.trim();
    const city     = document.getElementById('city').value;
    const service  = document.getElementById('service').value;
    const password = document.getElementById('password').value;

    if (!name)                       { showError('Please enter your full name.'); return false; }
    if (!phone || phone.length < 10) { showError('Please enter a valid phone number.'); return false; }
    if (!cnic || cnic.length < 15)   { showError('Please enter a valid CNIC number (e.g. 35201-1234567-1).'); return false; }
    if (!city)                       { showError('Please select your city.'); return false; }
    if (!service)                    { showError('Please select your service type.'); return false; }
    if (!password || password.length < 6) { showError('Password must be at least 6 characters.'); return false; }
  }
  if (step === 2) {
    const make  = document.getElementById('vmake').value;
    const model = document.getElementById('vmodel').value.trim();
    const year  = parseInt(document.getElementById('vyear').value);
    const plate = document.getElementById('vplate').value.trim();
    const color = document.getElementById('vcolor').value.trim();

    if (!make)              { showError('Please select vehicle make.'); return false; }
    if (!model)             { showError('Please enter vehicle model.'); return false; }
    if (!year || year < 2010) { showError('Vehicle must be year 2010 or newer.'); return false; }
    if (!plate)             { showError('Please enter license plate number.'); return false; }
    if (!color)             { showError('Please enter vehicle color.'); return false; }
  }
  return true;
}

function showError(msg) {
  alert('⚠️ ' + msg);
}

// ===== VEHICLE TYPE SELECT =====
function pickVtype(el, type) {
  document.querySelectorAll('.vtype').forEach(v => v.classList.remove('sel'));
  el.classList.add('sel');
  selectedVtype = type;
}

// ===== FILE UPLOAD =====
function triggerUpload(id) {
  document.getElementById(id).click();
}

function previewFile(input) {
  const id  = input.id;
  const box = input.closest('.upload-box');
  if (input.files && input.files[0]) {
    const file = input.files[0];
    // Validate file type
    const allowed = ['image/jpeg','image/jpg','image/png','application/pdf'];
    if (!allowed.includes(file.type)) {
      showError('Only JPG, PNG, or PDF files are allowed.');
      input.value = '';
      return;
    }
    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      showError('File is too large. Maximum size is 5MB.');
      input.value = '';
      return;
    }
    // Mark as uploaded
    uploadedFiles[id] = true;
    box.classList.add('uploaded');
    box.querySelector('.upload-icon').textContent = '✅';
    box.querySelector('small').textContent = file.name.slice(0, 20) + (file.name.length > 20 ? '…' : '');
    box.style.borderColor = '#22c55e';
  }
}

// ===== SUBMIT FORM =====
document.addEventListener('DOMContentLoaded', () => {

  // CNIC auto-format
  const cnicInput = document.getElementById('cnic');
  if (cnicInput) {
    cnicInput.addEventListener('input', e => {
      let v = e.target.value.replace(/\D/g, '');
      if (v.length > 5)  v = v.slice(0,5)  + '-' + v.slice(5);
      if (v.length > 13) v = v.slice(0,13) + '-' + v.slice(13,14);
      e.target.value = v.slice(0, 15);
    });
  }

  // Phone auto-format
  const phoneInput = document.getElementById('phone');
  if (phoneInput) {
    phoneInput.addEventListener('input', e => {
      let v = e.target.value.replace(/\D/g, '');
      if (v.length > 4) v = v.slice(0,4) + '-' + v.slice(4);
      e.target.value = v.slice(0, 12);
    });
  }

  // Form submit
  const form = document.getElementById('driverForm');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();

    // Check agreement
    if (!document.getElementById('agree').checked) {
      showError('Please agree to the Terms & Conditions.'); return;
    }

    // *** CHECK ALL 6 DOCUMENTS ARE UPLOADED ***
    const missing = Object.entries(uploadedFiles)
      .filter(([k, v]) => !v)
      .map(([k]) => uploadLabels[k]);

    if (missing.length > 0) {
      showError('The following required documents are missing:\n\n• ' + missing.join('\n• ') + '\n\nPlease upload all documents before submitting.');
      // Scroll to documents section
      document.querySelector('.upload-grid')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Show loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.textContent = '⏳ Submitting...';
    submitBtn.disabled    = true;

    // Build FormData (includes actual files)
    const fd = new FormData();
    fd.append('fullName',    document.getElementById('fullname').value);
    fd.append('phone',       document.getElementById('phone').value);
    fd.append('email',       document.getElementById('email').value);
    fd.append('cnic',        document.getElementById('cnic').value);
    fd.append('city',        document.getElementById('city').value);
    fd.append('serviceType', document.getElementById('service').value);
    fd.append('password',    document.getElementById('password').value);

    const vehicle = {
      make:  document.getElementById('vmake').value,
      model: document.getElementById('vmodel').value,
      year:  document.getElementById('vyear').value,
      color: document.getElementById('vcolor').value,
      plate: document.getElementById('vplate').value,
      type:  selectedVtype
    };
    fd.append('vehicle', JSON.stringify(vehicle));

    // Append all files
    ['cnic-front','cnic-back','license','vehicle-reg','photo','vehicle-photo'].forEach(id => {
      const fileInput = document.getElementById(id);
      if (fileInput && fileInput.files[0]) {
        fd.append(id, fileInput.files[0]);
      }
    });

    try {
      const API_BASE = window.RIDEPK_API_BASE || 'http://localhost:5000';
      const res  = await fetch(API_BASE + '/api/drivers/register', {
        method: 'POST', body: fd
      });
      const data = await res.json();

      if (data.success) {
        showSuccess();
      } else {
        submitBtn.textContent = 'Submit Application ✓';
        submitBtn.disabled    = false;
        showError(data.message || 'Registration failed. Please try again.');
      }
    } catch (err) {
      submitBtn.textContent = 'Submit Application ✓';
      submitBtn.disabled    = false;
      showError('Could not connect to server. Make sure the backend is running (npm run dev).');
    }
  });
});

function showSuccess() {
  document.getElementById('driverForm').classList.add('hidden');
  document.getElementById('success-msg').classList.remove('hidden');
}
