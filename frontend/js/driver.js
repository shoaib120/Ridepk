// =====================================================
//  driver.js — Driver registration form logic
// =====================================================

let currentFStep = 1;
let selectedVtype = 'car';

// ===== NAVIGATE FORM STEPS =====
function goFStep(n) {
  // Validate current step before moving forward
  if (n > currentFStep) {
    if (!validateFStep(currentFStep)) return;
  }

  // Hide all sections
  document.getElementById('fsec1').classList.add('hidden');
  document.getElementById('fsec2').classList.add('hidden');
  document.getElementById('fsec3').classList.add('hidden');

  // Show target section
  document.getElementById('fsec' + n).classList.remove('hidden');
  currentFStep = n;

  // Update step indicators
  ['fs1','fs2','fs3'].forEach((id, i) => {
    const el = document.getElementById(id);
    el.classList.remove('active', 'done');
    if (i + 1 < n) el.classList.add('done');
    if (i + 1 === n) el.classList.add('active');
  });

  // Scroll to top of form
  document.querySelector('.dform-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===== VALIDATE STEP =====
function validateFStep(step) {
  if (step === 1) {
    const name = document.getElementById('fullname').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const cnic = document.getElementById('cnic').value.trim();
    const city = document.getElementById('city').value;
    const service = document.getElementById('service').value;
    const password = document.getElementById('password').value;

    if (!name) { alert('Please enter your full name.'); return false; }
    if (!phone || phone.length < 10) { alert('Please enter a valid phone number.'); return false; }
    if (!cnic || cnic.length < 13) { alert('Please enter a valid CNIC number.'); return false; }
    if (!city) { alert('Please select your city.'); return false; }
    if (!service) { alert('Please select your service type.'); return false; }
    if (!password || password.length < 6) { alert('Password must be at least 6 characters.'); return false; }
  }
  if (step === 2) {
    const make = document.getElementById('vmake').value;
    const model = document.getElementById('vmodel').value.trim();
    const year = document.getElementById('vyear').value;
    const plate = document.getElementById('vplate').value.trim();
    const color = document.getElementById('vcolor').value.trim();

    if (!make) { alert('Please select vehicle make.'); return false; }
    if (!model) { alert('Please enter vehicle model.'); return false; }
    if (!year || parseInt(year) < 2010) { alert('Vehicle must be 2010 or newer.'); return false; }
    if (!plate) { alert('Please enter license plate number.'); return false; }
    if (!color) { alert('Please enter vehicle color.'); return false; }
  }
  return true;
}

// ===== SELECT VEHICLE TYPE =====
function pickVtype(el, type) {
  document.querySelectorAll('.vtype').forEach(v => v.classList.remove('sel'));
  el.classList.add('sel');
  selectedVtype = type;
}

// ===== TRIGGER FILE UPLOAD =====
function triggerUpload(id) {
  document.getElementById(id).click();
}

// ===== PREVIEW UPLOADED FILE =====
function previewFile(input) {
  const box = input.closest('.upload-box');
  if (input.files && input.files[0]) {
    box.classList.add('uploaded');
    const icon = box.querySelector('.upload-icon');
    icon.textContent = '✅';
    const small = box.querySelector('small');
    small.textContent = input.files[0].name.slice(0, 18) + '...';
  }
}

// ===== VALIDATE DOCUMENTS (Step 3) =====
function validateDocuments() {
  const required = [
    { id: 'cnic-front',   label: 'CNIC Front' },
    { id: 'cnic-back',    label: 'CNIC Back' },
    { id: 'license',      label: 'Driving License' },
    { id: 'vehicle-reg',  label: 'Vehicle Registration' },
    { id: 'photo',        label: 'Your Photo' }
  ];

  for (const doc of required) {
    const input = document.getElementById(doc.id);
    if (!input || !input.files || !input.files[0]) {
      alert('Please upload: ' + doc.label);
      return false;
    }
  }
  return true;
}

// ===== SUBMIT FORM =====
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('driverForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validate step 3 — terms
    const agree = document.getElementById('agree').checked;
    if (!agree) { alert('Please agree to the Terms & Conditions.'); return; }

    // Validate step 3 — required documents
    if (!validateDocuments()) return;

    // Build FormData so files are included
    const fd = new FormData();
    fd.append('fullName',    document.getElementById('fullname').value);
    fd.append('phone',       document.getElementById('phone').value);
    fd.append('email',       document.getElementById('email').value);
    fd.append('cnic',        document.getElementById('cnic').value);
    fd.append('city',        document.getElementById('city').value);
    fd.append('serviceType', document.getElementById('service').value);
    fd.append('password',    document.getElementById('password').value);

    // Vehicle info as JSON string (backend parses it)
    fd.append('vehicle', JSON.stringify({
      make:  document.getElementById('vmake').value,
      model: document.getElementById('vmodel').value,
      year:  document.getElementById('vyear').value,
      color: document.getElementById('vcolor').value,
      plate: document.getElementById('vplate').value,
      type:  selectedVtype
    }));

    // Attach document files
    fd.append('cnic-front',   document.getElementById('cnic-front').files[0]);
    fd.append('cnic-back',    document.getElementById('cnic-back').files[0]);
    fd.append('license',      document.getElementById('license').files[0]);
    fd.append('vehicle-reg',  document.getElementById('vehicle-reg').files[0]);
    fd.append('photo',        document.getElementById('photo').files[0]);

    // Vehicle photo is optional
    const vehiclePhotoInput = document.getElementById('vehicle-photo');
    if (vehiclePhotoInput && vehiclePhotoInput.files && vehiclePhotoInput.files[0]) {
      fd.append('vehicle-photo', vehiclePhotoInput.files[0]);
    }

    // Show loading state
    const submitBtn = document.querySelector('#driverForm button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting...'; }

    try {
      const res = await fetch((window.RIDEPK_API_BASE || 'https://ridepk.onrender.com') + '/api/drivers/register', {
        method: 'POST',
        // Do NOT set Content-Type — browser sets it automatically with boundary for FormData
        body: fd
      });

      const data = await res.json();

      if (res.ok && (data.success || data.message)) {
        showSuccess();
      } else {
        alert(data.message || 'Registration failed. Please try again.');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Application'; }
      }
    } catch (err) {
      console.error('Registration error:', err);
      alert('Network error. Please check your connection and try again.');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Application'; }
    }
  });
});

function showSuccess() {
  document.getElementById('driverForm').classList.add('hidden');
  document.getElementById('success-msg').classList.remove('hidden');
}

// CNIC auto-format: 12345-1234567-1
document.addEventListener('DOMContentLoaded', () => {
  const cnicInput = document.getElementById('cnic');
  if (cnicInput) {
    cnicInput.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '');
      if (v.length > 5 && v.length <= 12) v = v.slice(0,5) + '-' + v.slice(5);
      if (v.length > 13) v = v.slice(0,13) + '-' + v.slice(13,14);
      e.target.value = v.slice(0, 15);
    });
  }

  // Phone auto-format
  const phoneInput = document.getElementById('phone');
  if (phoneInput) {
    phoneInput.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '');
      if (v.length > 4) v = v.slice(0,4) + '-' + v.slice(4);
      e.target.value = v.slice(0, 12);
    });
  }
});
