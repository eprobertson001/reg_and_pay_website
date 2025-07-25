// --- FORM ELEMENTS ---
const plusOneCheckbox = document.getElementById('plus-one-checkbox');
const guestFields = document.getElementById('guest-fields');
const nightsSelect = document.getElementById('nights-select');

const firstNameInput = document.getElementById('first-name');
const lastNameInput = document.getElementById('last-name');
const guestFirstNameInput = document.getElementById('guest-first-name');
const guestLastNameInput = document.getElementById('guest-last-name');

// --- SUMMARY ELEMENTS ---
const summaryLine1 = document.getElementById('summary-line-1');
const subtotal1 = document.getElementById('subtotal-1');
const summaryLine2 = document.getElementById('summary-line-2');
const subtotal2 = document.getElementById('subtotal-2');
const processingFeeEl = document.getElementById('processing-fee');
const totalAmountEl = document.getElementById('total-amount');

// --- ERROR MESSAGE ELEMENTS ---
const generalError = document.getElementById('error-general');
const errorMessages = {
    firstName: document.getElementById('error-first-name'),
    lastName: document.getElementById('error-last-name'),
    guestFirstName: document.getElementById('error-guest-first-name'),
    guestLastName: document.getElementById('error-guest-last-name'),
    nights: document.getElementById('error-nights'),
};

let finalAmount = '0.00'; // To store the total for PayPal

// --- MAIN FUNCTION TO UPDATE EVERYTHING ---
function updateOrderAndValidate() {
    // 1. Get current values
    const isPlusOne = plusOneCheckbox.checked;
    const nights = parseInt(nightsSelect.value) || 0;
    
    // Show/hide guest fields
    guestFields.style.display = isPlusOne ? 'block' : 'none';

    // 2. Calculations
    const numGuests = isPlusOne ? 2 : 1;
    const costPerNight = numGuests * 0.01;
    const basePrice = costPerNight * nights;
    // PayPal fee is typically (price * percentage) + fixed fee
    const processingFee = basePrice > 0 ? (basePrice * 0.0349 + 0.45) : 0;
    const total = basePrice + processingFee;
    finalAmount = total.toFixed(2);
    
    // 3. Update Order Summary text
    summaryLine1.textContent = `${numGuests} guest${numGuests > 1 ? 's' : ''} x $0.01/guest`;
    subtotal1.textContent = `$${costPerNight.toFixed(2)}`;
    summaryLine2.textContent = `x ${nights} Night${nights !== 1 ? 's' : ''}`;
    subtotal2.textContent = `$${basePrice.toFixed(2)}`;
    processingFeeEl.textContent = `$${processingFee.toFixed(2)}`;
    totalAmountEl.textContent = `$${finalAmount}`;

    // 4. Validation
    let isValid = true;
    const hideError = (el) => { el.style.display = 'none'; };
    const showError = (el) => { el.style.display = 'block'; isValid = false; };
    
    // Hide all errors to start
    Object.values(errorMessages).forEach(hideError);
    hideError(generalError);

    if (!firstNameInput.value) showError(errorMessages.firstName);
    if (!lastNameInput.value) showError(errorMessages.lastName);
    if (!nightsSelect.value) showError(errorMessages.nights);
    
    if (isPlusOne) {
        if (!guestFirstNameInput.value) showError(errorMessages.guestFirstName);
        if (!guestLastNameInput.value) showError(errorMessages.guestLastName);
    }
    
    if (!isValid) {
        showError(generalError);
    }
    
    return isValid;
}

// --- PAYPAL BUTTONS LOGIC ---
const paypalButtons = paypal.Buttons({
    // Called when page loads
    onInit: function(data, actions) {
        actions.disable(); // Disable buttons by default
        
        // Listen for changes on all relevant fields
        document.querySelectorAll('#user-form input, #user-form select').forEach(el => {
            el.addEventListener('change', () => {
                const isValid = updateOrderAndValidate();
                if (isValid) {
                    actions.enable();
                } else {
                    actions.disable();
                }
            });
        });
    },
    // Called when button is clicked
    onClick: function(data, actions) {
        const isFormValid = updateOrderAndValidate();
        if (!isFormValid) {
            return actions.reject(); // Prevents PayPal pop-up
        }
        return actions.resolve();
    },
    // Setup the transaction
    createOrder: function(data, actions) {
        return actions.order.create({
            purchase_units: [{
                amount: {
                    value: finalAmount, // Use the dynamically calculated total
                    currency_code: 'USD'
                }
            }]
        });
    },
    // Finalize the transaction
    onApprove: function(data, actions) {
        return actions.order.capture().then(function(details) {

            // --- SAVE DATA TO GOOGLE SHEETS ---
            const scriptURL = 'YOUR_URL_HERE'; // <-- PASTE YOUR URL HERE

            // 1. Gather all the data from the form
            const isPlusOne = document.getElementById('plus-one-checkbox').checked;
            const formData = {
                transactionId: details.id,
                payerEmail: details.payer.email_address,
                firstName: document.getElementById('first-name').value,
                lastName: document.getElementById('last-name').value,
                plusOne: isPlusOne ? "Yes" : "No",
                guestFirstName: isPlusOne ? document.getElementById('guest-first-name').value : "N/A",
                guestLastName: isPlusOne ? document.getElementById('guest-last-name').value : "N/A",
                nights: document.getElementById('nights-select').value,
                totalPaid: details.purchase_units[0].amount.value
            };

            // 2. Send the data to your Google Script
            fetch(scriptURL, {
                method: 'POST',
                mode: 'no-cors', // Important for sending from a browser to Google Scripts
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            }).catch(err => console.error('Error sending data to Google Sheets:', err));


            // Hide form and show success message on completion
            document.querySelector('.container').innerHTML = `
                <div class="form-header">
                    <h2>Thank you for your payment!</h2>
                    <p>Your transaction has been completed successfully.</p>
                    <p>A confirmation has been sent to ${details.payer.email_address}.</p>
                </div>`;
        });
    },
    onError: function(err) {
        console.error('An error occurred with the PayPal button:', err);
    }
});

// Render the PayPal buttons if the container exists
if (document.getElementById('paypal-button-container')) {
    paypalButtons.render('#paypal-button-container');
}

// Initial call to set the summary on page load
updateOrderAndValidate();