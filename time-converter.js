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
 * Returns time and timezone information of the specified location.
 *
 * @param {string} timezone A partial url path that denotes a particular location
 * (e.g. 'America/New_York').
 * @throws Throws an error showing the api response status if that status
 * isn't ok
 * @return {Promise<WorldTimeAPIJSON>} An object containing information about the timezone.
 */
async function getTimezoneData(timezone) {
    const URL = `http://worldtimeapi.org/api/timezone/${timezone}`;
    const response = await fetch(URL);
    if(!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
    }
    return response.json();
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
