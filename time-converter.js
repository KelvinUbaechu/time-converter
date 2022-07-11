/**
 * Returns time and timezone information of the specified location.
 *
 * @param {string} timezone A partial url path that denotes a particular location
 * (e.g. 'America/New_York').
 * @throws Throws an error showing the api response status if that status
 * isn't ok
 * @return {Promise<any>} An object containing information about the timezone.
 */
async function getTimezoneData(timezone) {
    const URL = `http://worldtimeapi.org/api/timezone/${timezone}`;
    const response = await fetch(URL);
    if(!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
    }
    return response.json();
}
