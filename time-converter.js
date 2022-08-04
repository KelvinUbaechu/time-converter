/**
 * The JSON response returned by World Time API
 * @typedef {Object} WorldTimeAPIJSON
 * @property {string} abbreviation
 * @property {string} datetime
 * @property {number} day_of_week
 * @property {number} day_of_year
 * @property {boolean} dst
 * @property {string} dst_from
 * @property {integer} dst_offset
 * @property {string} dst_until
 * @property {number} raw_offset
 * @property {string} timezone
 * @property {number} unixtime
 * @property {string} utc_datetime
 * @property {string} utc_offset
 * @property {number} week_number
 */


/**
 * Returns the response JSON if the response has a status of 200 (OK). Throws an
 * error stating the HTTP response, if otherwise
 * @param {string} request_url The request url where response will come from
 * @throws Throws an error showing the response status if that status is not 200
 * @returns The response JSON
 */
 async function getResponseJSONIfOk(request_url) {
    const response = await fetch(request_url);
    if(!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
    }
    return response.json();
}


/**
 * Returns time and timezone information of the specified location.
 *
 * @param {string} timezone A partial url path that denotes a particular location
 * (e.g. 'America/New_York').
 * @throws Throws an error showing the api response status if that status
 * isn't ok
 * @return {Promise<WorldTimeAPIJSON>} An object containing information about the timezone.
 */
async function getTimezoneData(timezone) {
    const url = `http://worldtimeapi.org/api/timezone/${timezone}`;
    return getResponseJSONIfOk(url);
}


/** Returns the time string into milliseconds. The time returned
 * is the number of milliseconds in the given time. For example,
 * when given '01:00', the function returns 3600000.
 * 
 * @param {string} timeString The time in the format of '{optional negative}{hour}:{minutes}' (eg. '-04:00').
 * @return {number} The time in milliseconds.
 */
function convertTimeStringToMilliseconds(timeString) {
    const isNegative = timeString.charAt(0) === '-';
    const hoursAndMinutes = timeString.split(':');
    const hours = Math.abs(parseInt(hoursAndMinutes[0]));
    const minutes = hours * 60 + parseInt(hoursAndMinutes[1]);
    const milliseconds = minutes * 60000;
    return (isNegative) ? -milliseconds : milliseconds;
}


/**
 * Returns the time difference between the two timezones in milliseconds
 * @param {WorldTimeAPIJSON} originTZ The origin timezone information
 * @param {WorldTimeAPIJSON} targetTZ The target timezone information
 * @returns {number} The total time difference in milliseconds
 */
function getTimeDifference(originTZ, targetTZ) {
    const originUTCOffset = convertTimeStringToMilliseconds(originTZ.utc_offset);
    const targetUTCOffset = convertTimeStringToMilliseconds(targetTZ.utc_offset);
    return targetUTCOffset - originUTCOffset;
}


/**
 * Returns the time (in milliseconds) at the target timezone when it is at the given time at the
 * origin timezone. The time does not include the date. 
 * @param {WorldTimeAPIJSON} originTZ The origin timezone information.
 * @param {WorldTimeAPIJSON} targetTZ The target timezone information.
 * @param {number} originTime The time (in milliseconds) at the origin timezone.
 * @returns {number} The time at the target timezone.
 */
function findTimeAtTargetTZ(originTZ, targetTZ, originTime) {
    const timeDiff = getTimeDifference(originTZ, targetTZ);
    return timeDiff + originTime;
}


/**
 * Returns the hours and minutes that the milliseconds make up
 * @param {number} milliseconds The number of milliseconds
 * @returns An object with the hours and minutes made up by the milliseconds as properties
 */
function getHoursAndMinutesFromMilliseconds(milliseconds) {
    let date = new Date(milliseconds);
    return {
        hours: date.getUTCHours(),
        minutes: date.getUTCMinutes()
    }
}


/**
 * Pads zeros to the left of the given number, so that the
 * given number is always the given number of digits.
 * 
 * This function assumes that num has at most numOfDigits number.
 * @param {number} num The number to be padded.
 * @param {number} numOfDigits The number of digits of the padded number.
 * @returns {string} The padded number.
 */
function padNumWithZeros(num, numOfDigits) {
    const digits = [];
    for(let i = 0; i < numOfDigits; i++) {
        digits.push('0');
    }
    digits.push(num.toString());
    return digits.join('').slice(-numOfDigits);
}


/**
 * Converts a 24-hour time string (i.e. '15:34') to a 12-hour
 * time string (i.e '03:34 PM') 
 * @param {string} timeString 24-hour time string
 * @returns {string} Converted 12-hour time string
 */
function convert24HourTimeStringTo12Hour(timeString) {
    let [hours, minutes] = timeString.split(':').map(num => parseInt(num));
    let period;
    if(hours < 12) {
        period = 'AM';
    } else {
        period = 'PM';
        hours -= 12;
    }
    const hourString = (hours === 0) ? '12' : padNumWithZeros(hours, 2);
    const minuteString = padNumWithZeros(minutes, 2);
    return `${hourString}:${minuteString} ${period}`;
}

/**
 * Converts a 12-hour time string (i.e. '19:12') to a 12-hour
 * time string (i.e '07:12 PM')
 * @param {string} timeString 12-hour time string
 * @returns {string} Converted 24-hour time string
 */
 function convert12HourTimeStringTo24Hour(timeString) {
    const [bareTimeString, period] = timeString.split(' ');
    const [hours, minutes] = bareTimeString.split(':').map(num => parseInt(num));
    const minuteString = padNumWithZeros(minutes, 2);
    if(period === 'AM') {
        return (hours === 12) ? `00:${minuteString}` : bareTimeString;
    }
    const hourString = (hours === 12) ? '12' : padNumWithZeros(hours + 12);
    return `${hourString}:${minuteString}`;
}


/**
 * Transforms array of locale components into a version without underscores for
 * display.
 * @param {string[]} localeArray An array of locale components
 * @returns {Map<string, string>} A map that has the locale components as keys and their
 * display-friendly form as values.
 */
 function getOptionValueMap(localeArray) {
    return new Map(localeArray.map(key => [key, key.replace('_', ' ')]));
}


/**
 * Updates the time output to display the target time at the specified origin
 * time. The time output is in the 12-hour format. If the time input is incomplete
 * or either of the inputted timezone locales are incomplete, then the time output
 * is cleared.
 */
 function updateTimeOutput() {
    if(!(CURRENT_TIMEZONES.origin && CURRENT_TIMEZONES.target && timeInput.value)) {
        timeOutput.textContent = "--:-- --";
        return;
    }
    const timeInputMilliseconds = convertTimeStringToMilliseconds(timeInput.value);
    const targetTimeMilliseconds = findTimeAtTargetTZ(CURRENT_TIMEZONES.origin, CURRENT_TIMEZONES.target, timeInputMilliseconds);
    const {hours: targetTimeHours, minutes: targetTimeMinutes} = getHoursAndMinutesFromMilliseconds(targetTimeMilliseconds);
    timeOutput.textContent = convert24HourTimeStringTo12Hour(`${targetTimeHours}:${targetTimeMinutes}`);
}


/**
 * Clears the stored timezone for the category. Resets the UTC offset
 * for the content of the category as well.
 * @param {string} category Either 'origin' or 'target'.
 */
 function clearStoredTimezone(category) {
    CURRENT_TIMEZONES[category] = null;
    const utcOffsetPara = document.querySelector(`#${category} .utc-offset`);
    utcOffsetPara.textContent = 'UTC: N/A';
}


/**
 * Sets the disabled attribute for all the dropdowns within the given container.
 * @param {HTMLDivElement} dropdownContainer Container of dropdown divs.
 * @param {boolean} disabledState Whether the dropdowns should be disabled or enabled.
 */
 function setDisabledAttrOfDropdowns(dropdownContainer, disabledState) {
    dropdownContainer.childNodes.forEach(node => {
        const selectElement = node.lastChild;
        selectElement.disabled = disabledState;
    });
}


/**
 * Retrieves and stores the timezone data of the complete locale
 * @param {HTMLDivElement} dropdownContainer The container of dropdowns that contain
 * the updated locale
 * @param {string[]} localeComponents The components of the locale used to obtain
 * the timezone data
 */
 function updateStoredTimezones(dropdownContainer, localeComponents) {
    const partialUrl = localeComponents.join('/');
    setDisabledAttrOfDropdowns(dropdownContainer, true);
    const contentPanelId = dropdownContainer.parentElement.id;
    getTimezoneData(partialUrl)
        .then(data => {
            CURRENT_TIMEZONES[contentPanelId] = data;
            const utcOffsetPara = document.querySelector(`#${contentPanelId} .utc-offset`);
            utcOffsetPara.textContent = `UTC: ${data.utc_offset}`;
            setDisabledAttrOfDropdowns(dropdownContainer, false);
        })
        .then(updateTimeOutput)
        .catch(e => {
            console.error(e);
            setDisabledAttrOfDropdowns(dropdownContainer, false);
        });
}


/**
 * Removes all dropdown divs below the given dropdown div.
 * @param {HTMLDivElement} dropdownDiv The dropdown whose siblings below it will be removed.
 */
 function removeSiblingsUnderDropdown(dropdownDiv) {
    const parentDiv = dropdownDiv.parentElement;
    while(parentDiv.lastChild !== dropdownDiv) {
        parentDiv.removeChild(parentDiv.lastChild);
    }
}


/**
 * Gets the locale component title from the div that contains
 * the super (parent) component.
 * @param {HTMLDivElement} superDropdownDiv The dropdown div that contains the
 * super-component of the locale.
 * @returns {string} The title of the component (either 'location' or 'region').
 */
 function getComponentTitleFromSuperComponentDiv(superDropdownDiv) {
    const indexOfComponent = superDropdownDiv.parentElement.childNodes.length + 1;
    return (indexOfComponent === 2) ? 'location' : 'region';
}


/**
 * Returns an array of strings that represent the possible
 * values for the sub component of the given locale.
 * @param {string[]} localeComponents The components of the locale.
 * Can have a maximum of three elements representing the area, location,
 * and region components respectively. Should have at least an area component.
 * @returns {string[]|null} The possible values for the locale's sub component
 * or null if the locale isn't valid.
 */
 function getSubComponentValuesOfLocale([area, location, region]) {
    if(region) {
        return (GROUPED_TIMEZONES_LOCALES[area]?.[location]?.includes(region)) ? [] : null;
    }
    if(location) {
        return GROUPED_TIMEZONES_LOCALES[area]?.[location] ?? null;
    }
    return (GROUPED_TIMEZONES_LOCALES[area]) ? Object.keys(GROUPED_TIMEZONES_LOCALES[area]) : null;
}


/**
 * Update the dropdowns to reflect the changes to the selected locales.
 * @param {string} category Either 'origin' or 'target'.
 * @param {HTMLDivElement} updatedDropdownDiv The dropdown that contains the 'leaf'
 * of the updated locale.
 * @param {string[]|null} subComponentValues The possible values of the sub component
 * for the updated locale.
 */
function updateDropdowns(category, updatedDropdownDiv, subComponentValues) {
    removeSiblingsUnderDropdown(updatedDropdownDiv);
    if(subComponentValues === null || subComponentValues.length === 0) {
        return;
    }
    const subComponentTitle = getComponentTitleFromSuperComponentDiv(updatedDropdownDiv);
    const dropdownContainer = (category === 'origin') ? originDropdownContainer : targetDropdownContainer;
    const optionValueTexts = getOptionValueMap(subComponentValues);
    const subComponentDropdownId = `${category}-${subComponentTitle}`;
    const subComponentDropdownDiv = createDropdown(subComponentDropdownId, `${subComponentTitle}: `, optionValueTexts);
    dropdownContainer.appendChild(subComponentDropdownDiv);
}


/**
 * Return the locale of the dropdown.
 * 
 * In other words, get the locale components of the timezone up until we hit the
 * component that the given dropdown represents.
 * @param {HTMLDivElement} dropdownDiv The dropdown with the 'leaf' portion of the locale.
 * @returns {string[]} An array containing the components of the dropdown's locale.
 */
 function getLocaleOfDropdown(dropdownDiv) {
    const localeDropdowns = Array.from(dropdownDiv.parentElement.childNodes);
    const indexOfDropdownDiv = localeDropdowns.indexOf(dropdownDiv);
    return localeDropdowns.slice(0, indexOfDropdownDiv + 1).map(dropdown => {
        const selectElement = dropdown.lastChild;
        return selectElement.value;
    });
}


/**
 * Returns the category of the dropdown div.
 * 
 * The category is either 'origin' or 'target'.
 * @param {HTMLDivElement} dropdownDiv The dropdown to get the category of.
 * @returns {string} The category of the dropdown.
 */
 function getCategoryOfDropdown(dropdownDiv) {
    return dropdownDiv.id.split('-')[0];
}


/**
 * The callback for all select elements. Used to create and remove dropdowns
 * according to the selected locales.
 */
 function updateSelectedTimezoneCallback() {
    const category = getCategoryOfDropdown(this.parentElement);
    const localeComponents = getLocaleOfDropdown(this.parentElement);
    const subComponentValues = getSubComponentValuesOfLocale(localeComponents);
    updateDropdowns(category, this.parentElement, subComponentValues);
    if(subComponentValues === null || subComponentValues.length !== 0) {
        clearStoredTimezone(category);
        updateTimeOutput();
        return;
    }
    const dropdownContainer = this.parentElement.parentElement;
    updateStoredTimezones(dropdownContainer, localeComponents);
}


/**
 * Creates a div containing a dropdown with the given values as well as a label 
 * for the dropdown.
 * @param {string} id The id of the div and the name of the select tag.
 * @param {string} labelText The text of the label that's display besides the select element.
 * @param {Map<string, string>} optionValueTexts The value of each option and their associated text content
 * that will be displayed to the user.
 * @returns Returns a div with class dropdown containing a label and a select element.
 */
 function createDropdown(id, labelText, optionValueTexts) {
    const dropdownDiv = document.createElement('div');
    dropdownDiv.classList.add('dropdown');
    dropdownDiv.id = id;

    const dropdownLabel = document.createElement('label');
    dropdownLabel.htmlFor = id;
    dropdownLabel.textContent = labelText;

    const dropdown = document.createElement('select');
    dropdown.name = id;
    dropdown.addEventListener('change', updateSelectedTimezoneCallback);

    // Ensure blank select option is first
    const selectOption = document.createElement('option');
    selectOption.value = '(select)';
    selectOption.textContent = '(select)';
    dropdown.appendChild(selectOption);
    optionValueTexts.forEach((key, value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = key;
        dropdown.appendChild(option);
    });

    dropdownDiv.appendChild(dropdownLabel);
    dropdownDiv.appendChild(dropdown);
    return dropdownDiv;
}


/**
 * Changes the ids of the descendents of the dropdown containers to fit with 
 * the new category.
 * @param {HTMLDivElement} dropdownContainer The container whose descendents' ids
 * or names will change.
 * @param {string} newCategory The new category of the dropdown container.
 * Can be either 'origin' or 'target'.
 */
function changeCategoryOfDescendents(dropdownContainer, newCategory) {
    for(const dropdownDiv of dropdownContainer.childNodes) {
        const localeName = dropdownDiv.id.split('-')[1];
        const newId = `${newCategory}-${localeName}`;
        dropdownDiv.id = newId;
        const [label, selectElement] = dropdownDiv.childNodes;
        label.htmlFor = newId;
        selectElement.name = newId;
    }
}


/**
 * Swaps the places of the origin and target timezones
 * with each other.
 * The dropdown containers are swapped with one another.
 * The UTC offsets (if any) are swapped.
 * The value of the time input is swapped with the value
 * of the time output.
 */
function swapOriginAndTargetTimezones() {
    // Swaps the origin and target dropdowns
    const targetParent = targetDropdownContainer.parentElement;
    const originParent = originDropdownContainer.parentElement;
    [originDropdownContainer, targetDropdownContainer] = [targetDropdownContainer, originDropdownContainer];
    changeCategoryOfDescendents(targetDropdownContainer, 'target');
    changeCategoryOfDescendents(originDropdownContainer, 'origin');
    targetParent.insertAdjacentElement('afterbegin', targetDropdownContainer);
    originParent.insertAdjacentElement('afterbegin', originDropdownContainer);

    if(!timeOutput.textContent.startsWith('-') && timeInput.value) {
        const temp = timeOutput.textContent;
        timeOutput.textContent = convert24HourTimeStringTo12Hour(timeInput.value);
        timeInput.value = convert12HourTimeStringTo24Hour(temp);
    } else {
        timeOutput.textContent = '--:-- --';
        timeInput.value = '';
    }

    const targetUTCOffset = document.querySelector('#target .utc-offset');
    const originUTCOffset = document.querySelector('#origin .utc-offset');
    [targetUTCOffset.textContent, originUTCOffset.textContent] = [originUTCOffset.textContent, targetUTCOffset.textContent];

    [CURRENT_TIMEZONES.origin, CURRENT_TIMEZONES.target] = [CURRENT_TIMEZONES.target, CURRENT_TIMEZONES.origin];
}


/**
 * Transforms the array of locales composed of up to three components (area, location, and region,
 * read more about them here: http://worldtimeapi.org/pages/examples) into a global nested object
 * that groups these locales according to these components.
 * 
 * @param {string[]} zones An array of all the valid timezone locales that WorldTimeAPI can accept.
 */
 function loadTimezoneLocales(zones) {
    // Zones are appear like the following:
    // '{area}' or '{area}/{location}' or '{area}/{location}/{region}'
    for(const zone of zones) {
        const zoneComponents = zone.split('/');
        const area = zoneComponents[0];
        if(!(area in GROUPED_TIMEZONES_LOCALES)) {
            GROUPED_TIMEZONES_LOCALES[area] = {}
        }
        if(zoneComponents.length === 1) {
            continue;
        }
        const location = zoneComponents[1];
        const region = (zoneComponents.length === 3) ? zoneComponents[2] : null;
        if(!(location in GROUPED_TIMEZONES_LOCALES[area])) {
            GROUPED_TIMEZONES_LOCALES[area][location] = [];
        }
        if(region) {
            GROUPED_TIMEZONES_LOCALES[area][location].push(region);
        }
    }
}


/**
 * Loads the dropdowns containing the area locales, which are the top-level
 * of the locales that WorldTimeAPI can accept.
 */
function loadAreaDropdowns() {
    const areas = getOptionValueMap(Object.keys(GROUPED_TIMEZONES_LOCALES));
    originDropdownContainer.appendChild(createDropdown('origin-area', 'area: ', areas));
    targetDropdownContainer.appendChild(createDropdown('target-area', 'area: ', areas));
}


let originDropdownContainer = document.querySelector('#origin .dropdown-container');
let targetDropdownContainer = document.querySelector('#target .dropdown-container');
const timeInput = document.querySelector('#time-input');
const timeOutput = document.querySelector('#time-output');
const swapTimezonesBtn = document.querySelector('#switch-timezones');
const GROUPED_TIMEZONES_LOCALES = {}; // TODO: Create schema showing structure of this object
const CURRENT_TIMEZONES = {origin: null, target: null};

swapTimezonesBtn.addEventListener('click', swapOriginAndTargetTimezones);
timeInput.addEventListener('change', updateTimeOutput);

getResponseJSONIfOk('http://worldtimeapi.org/api/timezone')
    .then(loadTimezoneLocales)
    .then(loadAreaDropdowns)
    .catch(e => console.error(e));