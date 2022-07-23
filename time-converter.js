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
 * Returns an array of strings that represent the possible
 * values for the sub component of the given locale.
 * @param {string[]} localeComponents The components of the locale.
 * Can have a maximum of three elements representing the area, location,
 * and region components respectively. Should have at least an area component.
 * @returns {string[]} The possible values for the locale's sub component.
 */
function getSubComponentValuesOfLocale([area, location, region]) {
    if(region) {
        return [];
    }
    if(location) {
        return GROUPED_TIMEZONES_LOCALES[area][location];
    }
    return Object.keys(GROUPED_TIMEZONES_LOCALES[area]);
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
 * Update the dropdowns to reflect the changes to the selected locales.
 * @param {string} category Either 'origin' or 'target'.
 * @param {HTMLDivElement} updatedDropdownDiv The dropdown that contains the 'leaf'
 * of the updated locale.
 * @param {string[]} subComponentValues The possible values of the sub component
 * for the updated locale.
 */
function updateDropdowns(category, updatedDropdownDiv, subComponentValues) {
    removeSiblingsUnderDropdown(updatedDropdownDiv);
    if(subComponentValues.length === 0) {
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
 * The callback for all select elements. Used to create and remove dropdowns
 * according to the selected locales.
 */
function updateSelectedTimezoneCallback() {
    const category = getCategoryOfDropdown(this.parentElement);
    const localeComponents = getLocaleOfDropdown(this.parentElement);
    const subComponentValues = getSubComponentValuesOfLocale(localeComponents);
    updateDropdowns(category, this.parentElement, subComponentValues);
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


const originDropdownContainer = document.querySelector('#origin .dropdown-container');
const targetDropdownContainer = document.querySelector('#target .dropdown-container');
const GROUPED_TIMEZONES_LOCALES = {}; // TODO: Create schema showing structure of this object
getResponseJSONIfOk('http://worldtimeapi.org/api/timezone')
    .then(loadTimezoneLocales)
    .then(loadAreaDropdowns)
    .catch(e => console.error(e));