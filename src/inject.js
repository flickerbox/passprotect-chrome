/**
 * Detect to see whether or not this script has already been loaded or not. For
 * instance, if a developer includes passprotect-js in their site and a chrome
 * extension visitor stumbles across the same site, we don't want to double up
 * on notifications.
 */
 var scripts = document.getElementsByTagName("script");
 for (var i = 0; i < scripts.length; i++) {
 	var chunks = scripts[i].src.split("/");

 	if (chunks[chunks.length - 1] === "passprotect.min.js") {
 		throw "passprotect already loaded, skipping";
 	}
 }

 import * as sha1 from "js-sha1";
 import * as sha256 from "js-sha256";
 import * as vex from "../vendor/vex.combined.min.js";
 import "../vendor/vex.css";
 import "../vendor/vex-theme-wireframe.css";
 import "./style.css";


/**
 * Settings (for the Vex library)
 */
 vex.defaultOptions.className = "vex-theme-wireframe";
 vex.defaultOptions.escapeButtonCloses = false;
 vex.defaultOptions.overlayClosesOnClick = false;
 vex.dialog.buttons.YES.text = "Got it";


/**
 * Globals
 */
 var PASS_PROTECT_EMAIL_CHECK_URI = "https://haveibeenpwned.com/api/v2/breachedaccount/";
 var PASS_PROTECT_PASTE_CHECK_URI = "https://haveibeenpwned.com/api/v2/pasteaccountaccount/";
 var PASS_PROTECT_PASSWORD_CHECK_URI = "https://api.pwnedpasswords.com/range/";
 // New
 var PASS_PROTECT_DOMAIN_CHECK_URI = "https://40zds2aj31.execute-api.us-east-1.amazonaws.com/v1/domain?check_hash=";


/**
 * Format numbers in a nice, human-readable fashion =)
 *
 * Stolen from: https://stackoverflow.com/questions/2901102/how-to-print-a-number-with-commas-as-thousands-separators-in-javascript
 */
 function numberFormatter(number, fractionDigits = 0, thousandSeperator = ',', fractionSeperator = '.') {
 	if (number !==0 && !number || !Number.isFinite(number)) {
 		return number;
 	}

 	const frDigits = Number.isFinite(fractionDigits)? Math.min(Math.max(fractionDigits, 0), 7) : 0;
 	const num = number.toFixed(frDigits).toString();

 	const parts = num.split('.');
 	let digits = parts[0].split('').reverse();
 	let sign = '';

 	if (num < 0) {
 		sign = digits.pop();
 	}

 	let final = [];
 	let pos = 0;

 	while (digits.length > 1) {
 		final.push(digits.shift());
 		pos++;

 		if (pos % 3 === 0) {
 			final.push(thousandSeperator);
 		}
 	}

 	final.push(digits.shift());
 	return `${sign}${final.reverse().join('')}${frDigits > 0 ? fractionSeperator : ''}${frDigits > 0 && parts[1] ? parts[1] : ''}`;
 }


/**
 * This function returns true if the data is ignored and should not be used to
 * fire off a notification, false otherwise.
 *
 * @param {string} sensitiveData - The sensitive data to check for in
 *      localStorage / sessionStorage.
 */
 function isIgnored(sensitiveData) {
 	var data = sessionStorage.getItem(sensitiveData) || localStorage.getItem(sensitiveData);

 	return data === "true" ? true : false;
 }


/**
 * This function binds our protection to any suitable input elements on the
 * page. This way, we'll fire off the appropriate checks when an input value
 * changes.
 */
 function protectInputs() {
 	var inputs = document.getElementsByTagName("input");

 	for (var i = 0; i < inputs.length; i++) {
 		switch (inputs[i].type) {
 			case "email":
			//inputs[i].addEventListener("change", protectEmailInput);
			break;

			case "password":
			inputs[i].addEventListener("change", protectPasswordInput);
			inputs[i].classList.add("passProtect");
			break;
		}
	}

  //inputs = document.querySelectorAll("input[type='text']");
  //for (var i = 0; i < inputs.length; i++) {
  //  if (inputs[i].name.toLowerCase().indexOf("email") !== -1) {
  //    return inputs[i].addEventListener("change", protectEmailInput);
  //  }

  //  if (inputs[i].id.toLowerCase().indexOf("email") !== -1) {
  //    return inputs[i].addEventListener("change", protectEmailInput);
  //  }

  //  if (inputs[i].placeholder.toLowerCase().indexOf("email") !== -1) {
  //    return inputs[i].addEventListener("change", protectEmailInput);
  //  }
  //}
}


/**
 * Return a unique email hash suitable for caching.
 *
 * @param {string} email - The email address to hash.
 */
 function getEmailHash(email) {
 	return sha1(email + "-" + getHost());
 }


/**
 * Return the top level host name for a domain. EG: Given woot.adobe.com, will
 * return adobe.com.
 */
 function getHost() {
 	return window.location.host.split('.').slice(-2).join('.');
 }


/**
 * Protect email input elements. When a value is entered, we'll check the email
 * address against the haveibeenpwned API, then warn the user if their
 * credentials were compromised on the site they're currently on.
 *
 * @param {object} evt - The DOM event.
 */
 function protectEmailInput(evt) {
 	var host = getHost();
 	var xmlHttp = new XMLHttpRequest();
 	var inputValue = evt.currentTarget.value;
 	var badEmailDetected = false;

 	xmlHttp.onreadystatechange = function() {
 		if (xmlHttp.readyState === 4 && xmlHttp.status === 200) {
 			var breaches = JSON.parse(xmlHttp.responseText);

 			for (var i = 0; i < breaches.length; i++) {
 				if (breaches[i].Domain === host && breaches[i].IsVerified) {
 					badEmailDetected = true;
 					var message = [
 					'<p>' + breaches[i].Description + '</p>',
 					'<p>The email you entered was one of the <b>' + numberFormatter(breaches[i].PwnCount) + "</b> that were compromised. If you haven't done so already, you should change your password.</p>"
 					].join('');

 					vex.dialog.alert({
 						message: "Breach detected!",
 						input: message,
 						callback: function() {
						  // Cache this email once the user clicks the "I Understand" button
						  // so we don't continuously annoy the user with the same warnings.
						  localStorage.setItem(getEmailHash(inputValue), "true");
						}
					});
 				}
 			}
 		};
 	};

	// If this email is cached, we shouldn't do anything.
	if (isIgnored(getEmailHash(inputValue))) {
		return;
	}

	xmlHttp.open("GET", PASS_PROTECT_EMAIL_CHECK_URI + encodeURIComponent(inputValue), true);
	xmlHttp.send(null);
}


/**
 * Generate a unique hash which we can store locally to remember a password.
 * Now, it would obviously be unsafe to store a password hash in sessionStorage
 * (because if an XSS occurs it could be bad).
 *
 * BUT, what we can do to reduce risk and still maintain SOME sort of knowledge
 * (albeit, with a fairly high collision risk), we can essentially compute the
 * password hash, grab just the first 5 chars of it, then tack on our host info,
 * then hash the resulting string.
 *
 * This way we can reassemble a tiny bit of what we've got without potentially
 * leaking sensitive information.
 *
 * @param {string} password - The password to hash.
 */
 function getPasswordHash(password) {
	return sha1(sha1(password).slice(0, 5) + "-" + getHost());
 }


/**
 *
 * Set the Class on the password field for status
 * @param {object} evt - The DOM event object,  The status boolean
 */
 function setPassProtectStatus(evt, status){
 	switch (status){
 		case true:
 		evt.target.classList.remove("passProtect--Fail");
 		evt.target.classList.add("passProtect--Pass");
 		break;
 		case false:
 		evt.target.classList.remove("passProtect--Pass");
 		evt.target.classList.add("passProtect--Fail");
 		break;
 		default:
 		evt.target.classList.remove("passProtect--Fail");
 		evt.target.classList.remove("passProtect--Pass");
 	}
 }


/**
 * This function runs whenever a password input's value changes. It protects
 * checks the password against the haveibeenpwned API and alerts the user if the
 * password they've entered has been breached.
 *
 * @param {object} evt - The DOM event object.
 */
 function protectPasswordInput(evt) {

 	var inputValue = evt.currentTarget.value;
 	var hash = sha1(inputValue).toUpperCase();
 	var hashPrefix = hash.slice(0, 5);
 	var shortHash = hash.slice(5);
 	var passProtectStatus = null;
 	var xmlHttp = new XMLHttpRequest();

 	xmlHttp.onreadystatechange = function() {

 		if (xmlHttp.readyState === 4 && xmlHttp.status === 200) {

 			passProtectStatus = true;
 			var resp = xmlHttp.responseText.split("\n");

 			for (var i = 0; i < resp.length; i++) {
 				var data = resp[i].split(":");

 				if (data[0].indexOf(shortHash) === 0) {

 					passProtectStatus = false;

 					var message = [
 					'<p class="passprotect-icon"><img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzNSIgaGVpZ2h0PSIzMSIgZmlsbD0ibm9uZSI+PHBhdGggZmlsbD0iI0YyQzk0QyIgZmlsbC1ydWxlPSJldmVub2RkIiBkPSJNMTkuMTAzNyAxLjE5MjMxQzE4LjY4MzguNDc5NTQ1IDE3Ljg5ODkgMCAxNyAwYy0xLjM0MTMgMC0yLjQyODYgMS4wNjc2My0yLjQyODYgMi4zODQ2MiAwIC4xNzQ0MS4wMTkxLjM0NDQ1LjA1NTMuNTA4MjFMMS41Nzg5NCAyNi4zODA4Qy42NTY2OTggMjYuNzE5IDAgMjcuNTkxOSAwIDI4LjYxNTQgMCAyOS45MzI0IDEuMDg3MzEgMzEgMi40Mjg1NyAzMWMuMjQyIDAgLjQ3NTczLS4wMzQ4LjY5NjMtLjA5OTVMMy4xODU2NCAzMUgzMi4zMjg1bC4wOTE0LS4xNDk2QzMzLjM0MjggMzAuNTEyNSAzNCAyOS42MzkzIDM0IDI4LjYxNTRjMC0uMTA3Mi0uMDA3Mi0uMjEyNy0uMDIxMi0uMzE2MmwuNTM1NC0uODc2MUwxOS45NDI4IDEuMTkyMzFoLS44MzkxeiIgY2xpcC1ydWxlPSJldmVub2RkIi8+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTE3LjIxNDMgMjEuNDYxNmMtLjcyODYgMC0xLjIxNDMtLjQ3NjktMS4yMTQzLTEuMTkyM1Y5LjUzODVjMC0uNzE1MzkuNDg1Ny0xLjE5MjMxIDEuMjE0My0xLjE5MjMxLjcyODYgMCAxLjIxNDMuNDc2OTIgMS4yMTQzIDEuMTkyMzF2MTAuNzMwOGMwIC43MTU0LS40ODU3IDEuMTkyMy0xLjIxNDMgMS4xOTIzek0xNy4yMTQzIDI2LjIzMDhjLjY3MDYgMCAxLjIxNDMtLjUzMzggMS4yMTQzLTEuMTkyMyAwLS42NTg1LS41NDM3LTEuMTkyMy0xLjIxNDMtMS4xOTIzUzE2IDI0LjM4IDE2IDI1LjAzODVjMCAuNjU4NS41NDM3IDEuMTkyMyAxLjIxNDMgMS4xOTIzeiIvPjwvc3ZnPg==" /></p>',
 					'<h1>Unsafe password detected!</h1>',
 					'<p>This password you have entered is not safe to use. It has been found in <b>' + numberFormatter(parseInt(data[1]))  + '</b> data breaches.</p>',
 					'<p class="prevent-link"><a href="https://haveibeenpwned.com/" target="_blank">How to protect yourself</a></p>'
 					].join('');

 					vex.dialog.alert({
 						message: "",
 						input: message,
 						callback: function() {
						  // Cache this password once the user clicks the "I Understand" button
						  // so we don't continuously annoy the user with the same warnings.
						  //
						  // NOTE: We're using sessionStorage here (not localStorage) as we
						  // only want to not annoy the user for the duration of this
						  // session. Once they've come back to the site at a later time, we
						  // should bug them if they try to use the same password >:D
						  sessionStorage.setItem(getPasswordHash(inputValue), "true");
						}
					});
					// Break out of For as we already have a match
					break;
				}
			}
			// Set password field status class
			setPassProtectStatus(evt, passProtectStatus);
		}
	};

	// If this hash is cached, we shouldn't do anything.
	if (isIgnored(getPasswordHash(inputValue))) {
		// Set Password status class
		setPassProtectStatus(evt, false);
		return;
	}

	// Do not make the call if the input is empty
	// If our pass input is empty go back to default icon state
	if(evt.currentTarget.value.length === 0){
		setPassProtectStatus(evt, null);
	}else{
		// We're using the API with k-Anonymity searches to protect privacy.
		// You can read more about this here: https://haveibeenpwned.com/API/v2#SearchingPwnedPasswordsByRange
		xmlHttp.open("GET", PASS_PROTECT_PASSWORD_CHECK_URI + hashPrefix, true);
		xmlHttp.send(null);
	}
}

/**
 * This function runs on window load to see if the site is a Phishing site
 * If the domain is in our list it pops an alert to the user.
 *
 * @param {object} evt - The DOM event object.
 */
 function checkPhishingDomain (evt) {
	// New call with full href path and params
	var phishDomain = window.location.href;
	var phishDomainPreview = window.location.host
	var xmlHttp = new XMLHttpRequest();
	var currentDomain = sessionStorage.getItem("passProtectPhishDomain");

	if (currentDomain == null) {
		xmlHttp.onreadystatechange = function() {
			if (xmlHttp.readyState === 4 && xmlHttp.status === 200) {
				var resp = JSON.parse(xmlHttp.responseText);

				if (resp.result.match === true) {
					sessionStorage.getItem("passProtectPhishDomain");

					var message = [
					'<p class="passprotect-icon"><img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzNSIgaGVpZ2h0PSIzMSIgZmlsbD0ibm9uZSI+PHBhdGggZmlsbD0iI0YyQzk0QyIgZmlsbC1ydWxlPSJldmVub2RkIiBkPSJNMTkuMTAzNyAxLjE5MjMxQzE4LjY4MzguNDc5NTQ1IDE3Ljg5ODkgMCAxNyAwYy0xLjM0MTMgMC0yLjQyODYgMS4wNjc2My0yLjQyODYgMi4zODQ2MiAwIC4xNzQ0MS4wMTkxLjM0NDQ1LjA1NTMuNTA4MjFMMS41Nzg5NCAyNi4zODA4Qy42NTY2OTggMjYuNzE5IDAgMjcuNTkxOSAwIDI4LjYxNTQgMCAyOS45MzI0IDEuMDg3MzEgMzEgMi40Mjg1NyAzMWMuMjQyIDAgLjQ3NTczLS4wMzQ4LjY5NjMtLjA5OTVMMy4xODU2NCAzMUgzMi4zMjg1bC4wOTE0LS4xNDk2QzMzLjM0MjggMzAuNTEyNSAzNCAyOS42MzkzIDM0IDI4LjYxNTRjMC0uMTA3Mi0uMDA3Mi0uMjEyNy0uMDIxMi0uMzE2MmwuNTM1NC0uODc2MUwxOS45NDI4IDEuMTkyMzFoLS44MzkxeiIgY2xpcC1ydWxlPSJldmVub2RkIi8+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTE3LjIxNDMgMjEuNDYxNmMtLjcyODYgMC0xLjIxNDMtLjQ3NjktMS4yMTQzLTEuMTkyM1Y5LjUzODVjMC0uNzE1MzkuNDg1Ny0xLjE5MjMxIDEuMjE0My0xLjE5MjMxLjcyODYgMCAxLjIxNDMuNDc2OTIgMS4yMTQzIDEuMTkyMzF2MTAuNzMwOGMwIC43MTU0LS40ODU3IDEuMTkyMy0xLjIxNDMgMS4xOTIzek0xNy4yMTQzIDI2LjIzMDhjLjY3MDYgMCAxLjIxNDMtLjUzMzggMS4yMTQzLTEuMTkyMyAwLS42NTg1LS41NDM3LTEuMTkyMy0xLjIxNDMtMS4xOTIzUzE2IDI0LjM4IDE2IDI1LjAzODVjMCAuNjU4NS41NDM3IDEuMTkyMyAxLjIxNDMgMS4xOTIzeiIvPjwvc3ZnPg==" /></p>',
					'<h1>Phishing Domain detected!</h1>',
					'<p>The site you are visiting <b>' + phishDomainPreview  + '</b> is on a list of phishing domains.</p>',
					'<p><b>This domain may not be safe.</b></p>',
					'<p>This notice will not show again for this domain for the duration of this tab\'s session.</p>',
					'<p class="prevent-link"><a href="https://www.phishtank.com/what_is_phishing.php" target="_blank">Learn more</a></p>'
					].join('');

					vex.dialog.alert({
						message: "",
						input: message,
						callback: function() {
							sessionStorage.setItem("passProtectPhishDomain", true);
						}
					});
				}
			}
		}
		// New call with sha256
		xmlHttp.open("GET", PASS_PROTECT_DOMAIN_CHECK_URI + sha256(phishDomain), true);
		xmlHttp.send(null);
	}
}

// Bootstrap our passProtect functionality after the page has fully loaded.
window.addEventListener("load", function(){
	protectInputs();
	checkPhishingDomain();
});

