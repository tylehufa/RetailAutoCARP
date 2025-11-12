const { chromium } = require('playwright'); // Added Browser, Page
const path = require('path');
const fs = require('fs');
const os = require('os');
console.log('Script starting...');
const userProfilePath = os.homedir();
const filePath = path.join(userProfilePath, 'Downloads', 'output.json');
let scheduledDoors = {};  // or just: let scheduledDoors = {};
// This helps pkg include the browser executables
if (process.pkg) {
    const browserPath = path.join(
        path.dirname(process.execPath),
        'playwright-browsers'
    );
    process.env.PLAYWRIGHT_BROWSERS_PATH = browserPath;
}
const date = new Date();
const c_year = date.getFullYear();
const c_month = date.getMonth() + 1;

function readJsonFileSync(filePath) {
    try {
        const jsonString = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(jsonString);


        return data;
    } catch (error) {
        console.error('Error reading JSON file:', error);
        throw error;
    }
}

async function Login(page) {
    let welcome = await page.getByRole('heading').isVisible()

    if (!welcome) {
        try {
            await page.goto('https://midway-auth.amazon.com/');

            // Wait for username field to be visible
            await page.waitForLoadState('networkidle')

            console.log('Please log in manually. You have 30 seconds...');

            // Create a countdown timer
            let timeLeft = 30;
            const timer = setInterval(() => {
                process.stdout.write(`\rTime remaining: ${timeLeft} seconds`);
                timeLeft--;
                if (timeLeft < 0) clearInterval(timer);
            }, 1000);

            // Wait for login to complete
            await page.waitForTimeout(5000);

            console.log('Login successful');
        } catch (error) {
            console.error('Login failed:', error);
            throw error; // Re-throw the error to fail the test
        }
    }

}

// Helper functions
function saveProgress(data, filepath) {
    try {
        fs.writeFileSync(filepath, JSON.stringify(data), 'utf-8');
        console.log('Progress saved successfully');
    } catch (error) {
        console.error('Error saving progress:', error);
    }
}

function convertMonthToNumber(monthName) {
    const months = {
        'january': 1,
        'february': 2,
        'march': 3,
        'april': 4,
        'may': 5,
        'june': 6,
        'july': 7,
        'august': 8,
        'september': 9,
        'october': 10,
        'november': 11,
        'december': 12
    };

    const monthLower = monthName.toLowerCase();
    const monthNumber = months[monthLower];

    if (!monthNumber) {
        throw new Error(`Invalid month name: ${monthName}`);
    }

    return monthNumber;
}
const entries = []
// Type guard to check if the value is a valid bol_dict
function isValidBolDict(value) {
    return typeof value === 'object' && value !== null;
}
async function extractDocDoorNumbers(page) {

    return page.evaluate(() => {
        let docDoors = [];

        // Select all th elements with rowspan="2" and width="110px"
        let doorElements = document.querySelectorAll('th[rowspan="2"][width="110px"]');

        doorElements.forEach((element, index) => {
            let firstDiv = element.querySelector('div');
            if (firstDiv) {
                let number = firstDiv.textContent?.trim() || '';

                docDoors.push({ number, index });
            } else {
            }
        });

        return docDoors;
    });
}


const targetTimes = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00'];
let dockDoorCount = 0

async function checkAppointments(page) {
    await page.keyboard.press('End')
    return await page.evaluate((dockDoorCount) => {
        console.log('Starting checkAppointments with dockDoorCount:', dockDoorCount);
        let appointments = [];
        let slots = document.querySelectorAll('div.appointment_slot');
        console.log('Found appointment slots:', slots.length);

        // Create a map to track positions that have appointments
        let positionMap = new Map()

        let doorPositions = new Set(); // To track unique door positions

        // First, process existing appointments
        slots.forEach((slot, index) => {
            let style = window.getComputedStyle(slot);
            let top = parseInt(style.top);
            let left = parseInt(style.left);
            console.log(`top:${top}, left:${left}`)

            // Calculate positions
            let timePosition = Math.floor(top / 160);
            let doorPosition = Math.floor((left - 280) / 110) + 1; // Adjust based on starting position
            let positionKey = `${timePosition}-${doorPosition}`;
            // Add door position to our set
            doorPositions.add(doorPosition)

            console.log(`Slot ${index}:`, {
                top,
                left,
                timePosition,
                doorPosition,
                positionKey
            });

            // Get appointment details
            let appointmentLink = slot.querySelector('a');
            //let carrierDiv = slot.querySelector('.row .col-sm-12:nth-child(1)');

            let appointmentDetails = {
                timeslot: timePosition.toString(),
                dockdoor: doorPosition.toString(),
                hasAppointment: true,
                appointmentId: appointmentLink ? appointmentLink.textContent.trim() : undefined,
                position: { top: style.top, left: style.left }
            };

            console.log('Adding appointment:', appointmentDetails);
            positionMap.set(positionKey, appointmentDetails);
        });

        // Convert Set to sorted array and log it
        let sortedDoorPositions = Array.from(doorPositions).sort((a, b) => a - b);
        console.log('Unique door positions found:', sortedDoorPositions);

        console.log('Position map size:', positionMap.size);

        // Now fill in empty positions
        for (let door = 1; door <= sortedDoorPositions.length; door++) {
            for (let time = 0; time < 24; time++) {
                let positionKey = `${time}-${door}`;
                if (!positionMap.has(positionKey)) {
                    let emptySlot = {
                        timeslot: time.toString(),
                        dockdoor: door.toString(),
                        hasAppointment: false
                    };
                    appointments.push(emptySlot);
                    console.log('Adding empty slot:', positionKey, emptySlot);
                } else {
                    let filledSlot = positionMap.get(positionKey);
                    appointments.push(filledSlot);
                    console.log('Adding filled slot:', positionKey, filledSlot);
                }
            }
        }

        console.log('Total appointments array length:', appointments.length);
        return appointments

    }, dockDoorCount);
}

// Function to update status
function updateDoorStatus(date, emptyDoor, emptyTime) {
    let key = `${emptyTime}_${emptyDoor}`;
    if (scheduledDoors[date] && scheduledDoors[date][key]) {
        scheduledDoors[date][key].status = 'full';
        console.log(`Updated status for door ${emptyDoor} at time ${emptyTime} on ${date} to full`);
    }
    return scheduledDoors;
}
async function main() {
    const browser = await chromium.launch({
        headless: false,  // This makes the browser visible
    });
    const context = await browser.newContext();
    let page = await context.newPage();

    try {
        // Usage
        const data = readJsonFileSync(filePath);
        console.log('json:', data);
        // Create an array to store all entries
        const entries = [];
        // Define the main structure with dates
        // Iterate and store in variables
        Object.entries(data).forEach(([key, array]) => {
            const entry = {
                site: array[7] || 'XAV3',
                scac: array[6] || 'CCXP',
                container: key || '',
                crdd_year: parseInt(array[0]) || 0,
                crdd_month_num: convertMonthToNumber(array[2]) || 0,
                crdd_month: array[1] || '',
                crdd_month_full: array[2] || '',
                crdd_day: array[3] || '',
                crdd_hour: array[4] || '',
                crdd_min: array[5] || '',
                bol_dict: isValidBolDict(array[8]) ? array[8] : { 'Default': ['empty'] }
            };

            // Add to array
            entries.push(entry);

            // You can still log if needed
            console.log(`Entry ${key}:`, entry);
        });

        // Now you can use the entries array
        entries.forEach(entry => {
            // Do something with each entry
            const { site, scac, container, bol_dict, crdd_year, crdd_month, crdd_day, crdd_hour, crdd_min } = entry;
            // Use the variables as needed
        });
        // Or access specific entries
        const length = Object.keys(data).length
        page.on('console', msg => console.log('Browser Log:', msg.text()));
        await Login(page);
        await page.waitForTimeout(5000)
        await new Promise(resolve => setTimeout(resolve, 30000));

        const isadict = {};

        // Load existing data if it exists
        const backupFilePath = path.join(userProfilePath, 'Downloads', 'isa_output.json');
        try {
            if (fs.existsSync(backupFilePath)) {
                const existingData = JSON.parse(fs.readFileSync(backupFilePath, 'utf-8'));
                Object.assign(isadict, existingData);
                console.log('Loaded existing ISA data:', isadict);
            }
        } catch (error) {
            console.error('Error loading existing ISA data:', error);
        }
        console.log(`The length of the array is ${length}`)
        for (let j = 0; j < length; j++) {

            let isaPart = ''; 
            let shipPart =' ' // Initialize for each iteration

            try {
                let Entry = entries[j]


                // Skip if container already exists in isadict
                if (isadict[Entry.container]) {
                    console.log(`Container ${Entry.container} already processed, skipping...`);
                    continue;
                }
                // Wait for 5 seconds
                try {
                    await page.goto(`https://fc-inbound-dock-hub-na.aka.amazon.com/en_US/#/dockmaster/appointment/${Entry.site}/new/appointmentDetail`, { timeout: 0 })
                    //console.log('First entry site:', Entry.site);
                    await page.waitForLoadState('networkidle')
                    await page.getByLabel('Appointment Type').click()
                    await page.getByLabel('Appointment Type').selectOption('0: CARP');
                    await page.getByLabel('Load Type')
                    await page.getByLabel('Load Type').selectOption('0: DROP')
                    await page.locator('#carrier').click();
                    await page.locator('#carrier').fill(Entry.scac);
                    await page.getByRole('button', { name: 'Search' }).click();
                    await page.getByRole('textbox', { name: 'Trailer Number' }).click();
                    await page.getByRole('textbox', { name: 'Trailer Number' }).fill(Entry.container);
                    await page.locator('#crdd').click();


                    if (Entry.crdd_month_num === c_month && Entry.crdd_year === c_year) {
                        await page.getByLabel(`${Entry.crdd_month_full} ${(parseInt(Entry.crdd_day) - 1).toString()},`).click();
                        await page.getByLabel(`${Entry.crdd_month_full} ${(parseInt(Entry.crdd_day) - 1).toString()},`).press('Tab')
                        await page.getByRole('button', { name: 'expand_less icon' }).first().press('Tab');
                        await page.getByRole('button', { name: 'expand_less icon' }).nth(1).press('Tab');
                        await page.keyboard.type(Entry.crdd_hour);
                        await page.keyboard.press('Tab')
                        await page.keyboard.type(Entry.crdd_min)
                        await page.getByRole('button').filter({ hasText: 'done' }).click();
                    }
                    else {
                        await page.getByRole('button', { name: 'Choose month and year' }).click();
                        await page.getByText(`${Entry.crdd_year}`).click();
                        await page.getByText(`${Entry.crdd_month}`).click();
                        await page.getByLabel(`${Entry.crdd_month_full} ${(parseInt(Entry.crdd_day) - 1 || 1).toString()},`).getByText(`${(parseInt(Entry.crdd_day) - 1 || 1).toString()}`).click();
                        await page.getByLabel(`${Entry.crdd_month_full} ${(parseInt(Entry.crdd_day) - 1 || 1).toString()},`).getByText(`${(parseInt(Entry.crdd_day) - 1 || 1).toString()}`).press('Tab')
                        await page.getByRole('button', { name: 'expand_less icon' }).first().press('Tab');
                        await page.getByRole('button', { name: 'expand_less icon' }).nth(1).press('Tab');
                        await page.keyboard.type(Entry.crdd_hour);
                        await page.keyboard.press('Tab')
                        await page.keyboard.type(Entry.crdd_min)
                        await page.getByRole('button').filter({ hasText: 'done' }).click();
                    }
                    await page.getByLabel('Dock Door Type').selectOption('0: 1');
                    await page.getByText('Is it a recurring appointment? Appointment Type CARP SMALL_PARCEL SUPPLIES')
                    await page.keyboard.press('ArrowDown')
                    await page.keyboard.press('ArrowDown')
                    await page.keyboard.press('ArrowDown')
                    await page.keyboard.press('ArrowDown')
                    await page.keyboard.press('ArrowDown')
                    await page.keyboard.press('ArrowDown')
                    await page.keyboard.press('ArrowDown')
                    await page.keyboard.press('ArrowDown')
                    await page.keyboard.press('ArrowDown')
                    await page.keyboard.press('ArrowDown')
                    await page.keyboard.press('ArrowDown')
                    await page.locator('#dateSelectorInput').click()
                    await page.keyboard.press('ArrowDown')
                    await page.keyboard.press('ArrowDown')
                    await page.keyboard.press('ArrowDown')
                    if (Entry.crdd_month_num === c_month && Entry.crdd_year === c_year) {
                        await page.getByLabel(`${Entry.crdd_month_full} ${Entry.crdd_day},`).getByText(`${Entry.crdd_day}`).click()
                    }
                    else {
                        await page.getByRole('button', { name: 'Choose month and year' }).click();
                        await page.getByText(`${Entry.crdd_year}`).click();
                        await page.getByText(`${Entry.crdd_month}`).click();
                        await page.getByLabel(`${Entry.crdd_month_full} ${Entry.crdd_day},`).getByText(`${Entry.crdd_day}`).click();
                    }
                    await page.getByRole('button').filter({ hasText: 'done' }).click()

                    let empties = await page.getByRole('button', { name: 'Show empty dock doors' }).isVisible()
                    if (empties) {
                        try {
                            await page.getByRole('button', { name: 'Show empty dock doors' }).click()
                        } catch (error) {
                            console.error('button click failed:', error);
                            throw error; // Re-throw the error to fail the test
                        }
                    }
                    else { console.log("Show empties button not found") }
                    let Cleanslate = await page.getByText('No appointments for the day').isVisible()
                    if (!scheduledDoors[Entry.crdd_day]) {
                        scheduledDoors[Entry.crdd_day] = {};
                    }
                    if (!Cleanslate) {
                        console.log('Cleanslate not found, proceeding with existing appointments');

                        // Wait for page to update
                        await Promise.all([
                            page.waitForLoadState('networkidle'),
                            page.waitForSelector('div.appointment_slot'),
                            page.waitForSelector('th[rowspan="2"][width="110px"]'
                            )
                        ]);
                        let pageStateCheck = await page.evaluate(() => {
                            return {
                                hasAppointmentSlots: document.querySelectorAll('div.appointment_slot').length,
                                hasDockDoors: document.querySelectorAll('th[rowspan="2"][width="110px"]').length
                            };
                        });
                        console.log('Page state:', pageStateCheck);


                        let docDoors = await extractDocDoorNumbers(page);
                        let doorNumbers = docDoors.map(Door => Door.number);
                        let dockDoorCount = doorNumbers.length

                        console.log('Dock Door Numbers:', doorNumbers);
                        console.log('Dock Door Count:', dockDoorCount);


                        let appointments = await checkAppointments(page);
                        console.log('Appointments:', appointments)
                        let firstFiveDoors = doorNumbers.slice(0, 40);
                        for (let doorIndex = 1; doorIndex < firstFiveDoors.length + 1; doorIndex++) {
                            let doorNumber = doorNumbers[doorIndex - 1]; // Adjust index for doorNumbers array

                            targetTimes.forEach(time => {
                                let hour = parseInt(time);
                                console.log(`Checking appointments for Door ${doorIndex} ${doorNumber} at ${time}`);

                                let appointment = appointments.find(apt =>
                                    parseInt(apt.timeslot) === hour &&
                                    parseInt(apt.dockdoor) === parseInt(doorNumber)
                                );

                                //console.log(`Appointment found:`, appointment);

                                let key = `${time}_${doorNumber}`;
                                if (!scheduledDoors[Entry.crdd_day][key]) {
                                    scheduledDoors[Entry.crdd_day][key] = {
                                        time: time,
                                        door: doorNumber,
                                        status: appointment?.hasAppointment ? 'full' : 'empty'
                                    };
                                    console.log(`Created new entry for ${Entry.crdd_day}, key: ${key}`);
                                } else {
                                    console.log(`Entry already exists for ${Entry.crdd_day}, key: ${key}`);
                                }

                            });
                        }

                        EmptyDoors = Object.values(scheduledDoors[Entry.crdd_day]).filter(info => {
                            // Add validation check
                            if (!info || !info.door) {
                                console.log('Found invalid entry:', info);
                                return false;
                            }
                            return info.status === 'empty';
                        }).sort((a, b) => {
                            // Add safety checks in the sort function
                            if (!a || !b || !a.door || !b.door) {
                                console.log('Invalid entry in sort:', { a, b });
                                return 0;
                            }
                            console.log('Comparing doors:', a.door, b.door);
                            let doorComparison = parseInt(a.door) - parseInt(b.door);

                            if (doorComparison !== 0) return doorComparison;

                            return a.time.localeCompare(b.time);
                        })

                        console.log('DoorMap structure:', scheduledDoors[Entry.crdd_day]); // Add this to see the full structure

                        let Record = parseInt(Object.keys(EmptyDoors)[0])
                        console.log('Record:', Record)
                        if (Record >= 0) {
                            console.log('Door Map Contents:');
                            Object.entries(EmptyDoors).slice(0, 20).forEach(([key, value]) => {
                                console.log(`${key}: `, value)
                            });
                            console.log(`Empty Door:${EmptyDoors[Record].door}`)
                            console.log(`Empty Hour: ${EmptyDoors[Record].time}`)
                        };

                        if (Record >= 0 && EmptyDoors[Record]) {
                            scheduledDoors = updateDoorStatus(Entry.crdd_day, EmptyDoors[Record].door, EmptyDoors[Record].time);
                        }


                        await page.getByLabel('Dock Door', { exact: true }).selectOption(`${parseInt(EmptyDoors[Record].door) - 1}: ${EmptyDoors[Record].door}`)
                        await page.getByRole('textbox', { name: 'Start Date' }).click()
                        await page.keyboard.press('ArrowUp')
                        await page.keyboard.press('ArrowUp')
                        await page.keyboard.press('ArrowUp')
                        await page.keyboard.press('ArrowUp')
                        await page.keyboard.press('ArrowUp')
                        await page.getByRole('button', { name: 'Choose month and year' }).click();
                        await page.getByText(`${Entry.crdd_year}`).click();
                        await page.getByText(`${Entry.crdd_month}`).click();
                        await page.getByLabel(`${Entry.crdd_month_full} ${Entry.crdd_day},`).getByText(`${Entry.crdd_day}`).click()
                        await page.getByLabel(`${Entry.crdd_month_full} ${Entry.crdd_day},`).getByText(`${Entry.crdd_day}`).press('Tab')
                        await page.getByRole('button', { name: 'expand_less icon' }).first().press('Tab');
                        await page.getByRole('button', { name: 'expand_less icon' }).nth(1).press('Tab');
                        console.log('Regular Time:', EmptyDoors[Record].time.split(':')[0])
                        await page.keyboard.type(`${EmptyDoors[Record].time.split(':')[0]}`);
                        await page.keyboard.press('Tab')
                        await page.keyboard.type(`${EmptyDoors[Record].time.split(':')[1][0].substring(0, 2)}`);
                        await page.waitForTimeout(1000)
                        await page.getByRole('button').filter({ hasText: 'done' }).click();
                    } else {
                        console.log('clean state found, resoring to defaults')

                        let Door = 1
                        let time = '07:00'
                        EmptyDoors = { 0: { door: Door, time: time }}

                        await page.getByLabel('Dock Door', { exact: true }).selectOption(`${Door - 1}: ${Door}`)
                        await page.getByRole('textbox', { name: 'Start Date' }).click()
                        await page.keyboard.press('ArrowUp')
                        await page.keyboard.press('ArrowUp')
                        await page.keyboard.press('ArrowUp')
                        await page.keyboard.press('ArrowUp')
                        await page.keyboard.press('ArrowUp')
                        await page.getByRole('button', { name: 'Choose month and year' }).click();
                        await page.getByText(`${Entry.crdd_year}`).click();
                        await page.getByText(`${Entry.crdd_month}`).click();
                        await page.getByLabel(`${Entry.crdd_month_full} ${Entry.crdd_day},`).getByText(`${Entry.crdd_day}`).click()
                        await page.getByLabel(`${Entry.crdd_month_full} ${Entry.crdd_day},`).getByText(`${Entry.crdd_day}`).press('Tab')
                        await page.getByRole('button', { name: 'expand_less icon' }).first().press('Tab');
                        await page.getByRole('button', { name: 'expand_less icon' }).nth(1).press('Tab');
                        console.log('Clean state Time:', time.split(':')[0]);
                        await page.keyboard.type(`${time.split(':')[0]}`);
                        await page.keyboard.press('Tab')
                        await page.keyboard.type(`${time.split(':')[1][0]}`);
                        await page.waitForTimeout(2000)
                        await page.getByRole('button').filter({ hasText: 'done' }).click();
                    }
                    await page.keyboard.press('Tab')
                    await page.keyboard.press('1')
                    await page.keyboard.press('Tab')
                    await page.keyboard.press('0')
                    await page.getByRole('textbox', { name: 'Appointment Comments' }).click();
                    await page.getByRole('textbox', { name: 'Appointment Comments' }).fill('XAV3AutoCARP');
                    await page.getByRole('button', { name: 'Save' }).click()
                    await page.keyboard.press('ArrowUp')
                    await page.keyboard.press('ArrowUp')
                    await page.keyboard.press('ArrowUp')
                    await page.keyboard.press('ArrowUp')
                    await page.keyboard.press('ArrowUp')
                    await page.keyboard.press('ArrowUp')
                    await page.keyboard.press('ArrowUp')
                    await page.keyboard.press('ArrowUp')
                    await page.keyboard.press('ArrowUp')
                    await page.keyboard.press('ArrowUp')
                    await page.keyboard.press('ArrowUp')
                    await page.keyboard.press('ArrowUp')
                    await page.keyboard.press('ArrowUp')
                    await page.keyboard.press('ArrowUp')
                    await page.keyboard.press('ArrowUp')
                    await page.keyboard.press('ArrowUp')
                    await page.keyboard.press('ArrowUp')
                    await page.keyboard.press('ArrowUp')
                    await page.keyboard.press('ArrowUp')
                    await page.keyboard.press('ArrowUp')
                    await page.keyboard.press('ArrowUp')
                    await page.keyboard.press('ArrowUp')
                    await page.keyboard.press('ArrowUp')
                    await page.keyboard.press('ArrowUp')
                    let isa_text = await page.getByText('Successfully created an').textContent()
                    console.log('ISA Text:', isa_text);
                    if (isa_text) {
                        isaPart = isa_text.split(':')[1]?.trim() || '';  // Use optional chaining and provide default
                        console.log('ISA Parts:', isaPart);
                    } else {
                        console.log('No ISA text found');
                    }

                    let bolKey = Object.keys(Entry.bol_dict)[0]; // join keys with comma and space
                    if (bolKey === 'Default') {
                        console.log('BOL key is empty or undefined, using default value');
                    }
                    else {
                        try {
                            await page.getByRole('link', { name: 'Shipment detail' }).click()
                            await page.waitForTimeout(3000)
                            const chunkSize = 10;
                            let values = Object.values(Entry.bol_dict)[0];
                            for (let i = 0; i < values.length; i += chunkSize) {
                                const chunk = values.slice(i, i + chunkSize);
                                const povalues = chunk.join(', ');
                                await page.waitForTimeout(1000); // 1 second delay
                                await page.getByRole('textbox', { name: 'PRO' }).click()
                                await page.getByRole('textbox', { name: 'PRO' }).fill(Entry.container)
                                await page.getByRole('textbox', { name: 'BOLs' }).click()
                                await page.getByRole('textbox', { name: 'BOLs' }).fill(bolKey)
                                await page.getByRole('button', { name: 'Add Shipment' }).click()
                                await page.getByRole('link', { name: 'PO Info' }).click()
                                await page.getByRole('textbox', { name: 'PO1,PO2,...' }).fill(povalues);
                                await page.waitForTimeout(1000); // 1 second delay
                                await page.getByRole('button', { name: 'Add POs' }).click();
                                await page.waitForTimeout(1000); // 1 second delay
                                await page.getByRole('button', { name: 'Save' }).click()
                                await page.keyboard.press('ArrowUp')
                                await page.keyboard.press('ArrowUp')
                                await page.keyboard.press('ArrowUp')
                                await page.keyboard.press('ArrowUp')
                                await page.keyboard.press('ArrowUp')
                                let ship_text = await page.getByText('Successfully saved Shipment').textContent()
                                if (ship_text) {
                                shipPart = ship_text.split('Shipment')[1]?.trim() || '';
                        console.log('Ship Parts:', isaPart);
                    } else {
                        console.log('No Shipment ID found');
                    }
                            }
                        } catch (error) {
                            console.error('Error during BOL processing:', error);
                            // Save current progress
                        }
                        // Only add to dictionary if isaPart exists
                        // Only add to dictionary if isaPart exists
                    }
                    if (isaPart) {
                        // Check if EmptyDoors and EmptyDoors[Record] exist
                        let Record = parseInt(Object.keys(EmptyDoors)[0])
                        if (EmptyDoors && EmptyDoors[Record] && shipPart) {
                            isadict[Entry.container] = {
                                Container: Entry.container,
                                ISA: isaPart,
                                Shipment: shipPart || 'PO conversion failed',
                                Hour: EmptyDoors[Record].time ? EmptyDoors[Record].time.split(':')[0] : '',
                                Door: EmptyDoors[Record].door || ''
                            };
                            console.log('Current dictionary size:', Object.keys(isadict).length);
                            console.log('Dictionary contents:', isadict);
                        } else {
                            isadict[Entry.container] = {
                                Container: Entry.container,
                                ISA: isaPart,
                                Shipment: shipPart || 'PO conversion failed',
                                Hour: time ? time.split(':')[0] : '',
                                Door: `${Door}` || ''
                            }
                            console.log('EmptyDoors or EmptyDoors[Record] is undefined, skipping dictionary update');
                        }
                    } else {
                        console.log('No ISA part found, skipping dictionary update');
                    }
                    // Save after each successful entry
                    saveProgress(isadict, backupFilePath);
                    console.log(`Successfully processed container ${Entry.container}`);
                } catch (error) {
                    console.error(`Error processing container ${Entry.container}:`, error);
                    // Save current progress
                    saveProgress(isadict, backupFilePath);
                    continue; // Skip to next container
                }
            } catch (error) {
                console.error(`Error processing entry ${j}:`, error);
                // Save current progress
                saveProgress(isadict, backupFilePath);
            }
        }
        // Final save at the end
        try {
            await page.close();
            saveProgress(isadict, backupFilePath);
            console.log('Script Completed Successfully');
            console.log('Final ISA dictionary:', isadict);
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
        console.log('Script ending...');
    }
    catch (error) {
        console.error('Error in main process:', error);
    } finally {
        await browser.close();
        console.log('Script Completed');
    }
}
// Run the program
main().catch(console.error);

