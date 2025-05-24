(async () => {
    await waitForContentLoad();
    addDateAndNoteColumns();
    addSubmitButton();
})();

async function waitForContentLoad() {
    // On first load the page will reload it's contents
    await new Promise(resolve => setTimeout(resolve, 1000));
    // The class name will change from "ui-mobile" on initial load to 
    // "ui-mobile ui-loading" and finally back to "ui-mobile" once it's done
    while (document.documentElement.className !== "ui-mobile") {
        await new Promise(resolve => setTimeout(resolve, 200));
    }
}

function addSubmitButton() {
    // Add submit button
    if (document.getElementById("my-floating-button")) return; // Button already exists
    const button = document.createElement("button");
    button.id = "my-floating-button";
    button.textContent = "Submit Requirements";
    button.style.position = "fixed";
    button.style.bottom = "20px";
    button.style.right = "20px";
    button.style.zIndex = "10000";
    button.style.padding = "10px 15px";
    button.style.backgroundColor = "#4CAF50";
    button.style.color = "white";
    button.style.border = "none";
    button.style.borderRadius = "5px";
    button.style.cursor = "pointer";
    button.style.boxShadow = "0px 2px 6px rgba(0,0,0,0.3)";
    button.addEventListener("click", () => {
        collectData();
    });
    document.querySelector('table.requirementsTable').appendChild(button);
}

function addDateAndNoteColumns() {
    if (document.querySelector(".ext-date-input")) return;

    // Add new cells to each row
    const table = document.querySelector('table.requirementsTable');
    const rows = table.rows;
    if (!rows.length) return;
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        // Add date cell
        const dateCell = document.createElement('td');
        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.classList.add('ext-date-input');
        dateCell.appendChild(dateInput);
        row.appendChild(dateCell);

        // Add note cell
        const noteCell = document.createElement('td');
        const noteInput = document.createElement('input');
        noteInput.type = 'text';
        noteInput.classList.add('ext-note-input');
        noteInput.placeholder = 'Approved by...';
        noteCell.appendChild(noteInput);
        row.appendChild(noteCell);
    }
}

async function collectData() {
    const firstName = document.querySelector('h1.ui-title a#account').textContent.split(' ')[0];
    rankRequirementText = document.querySelector('h1.ui-title').lastElementChild.lastChild.textContent;
    // Go from 'Scout Rank Requirements' to 'Scout Requirement' to match note title text
    rankRequirementText = rankRequirementText.trim().replace('Rank ', '').replace('Requirements', 'Requirement');

    const table = document.querySelector('table.requirementsTable');
    const rows = table.rows;
    const myRows = [];
    for (let i = 0; i < rows.length; i++) {
        const rowData = getRowData(rows[i]);
        if (rowData.dateCompleted || rowData.note) {
            myRows.push(rowData);
        }
    }

    let message = `Are you sure you want to submit ${firstName}'s ${rankRequirementText}s?\n\n`;
    myRows.forEach(row => {
        message += `${row['requirementNumber']}: ${(row['dateCompleted'] || '   No date   ')}  ${row['note'] || 'No Note'}\n`;
    });
    const confirm = window.confirm(message);
    if (confirm) {
        const data = {
            name: firstName,
            rank: rankRequirementText,
            rows: myRows
        };
        console.log('Submitting data...');
        await submitData(data);
    } else {
        console.log('Submission cancelled.');
    }
}

function getRowData(row) {
    const dateInput = row.querySelector('input.ext-date-input');
    const noteInput = row.querySelector('input.ext-note-input');

    // Get date in correct format for submission
    let formattedDate = '';
    if (dateInput && dateInput.value) {
        const [year, month, day] = dateInput.value.split('-');
        formattedDate = `${month}/${day}/${year}`;
    }

    // Get rank requirement and scout user IDs from the link parameters
    const link = row.querySelector('a.ui-link').href;
    const parsedUrl = new URL(link);
    const params = parsedUrl.searchParams;
    const rankRequirementID = params.get('RankRequirementID');
    const scoutUserId = params.get('ScoutUserID');

    // Get the requirement number from the row
    requirementNumber = row.querySelector('td.listNumberTD div').lastChild.textContent;
    requirementNumber = requirementNumber.trim().replace('.', '');

    rowData = {
        url: link,
        rankRequirementID: rankRequirementID,
        scoutUserId: scoutUserId,
        dateCompleted: formattedDate,
        note: noteInput ? noteInput.value : '',
        requirementNumber: requirementNumber
    };

    return rowData;
}

async function submitData(data) {
    errors = [];
    for (const row of data.rows) {
        noteError = await submitNote(row.note, row.rankRequirementID, row.requirementNumber, row.scoutUserId, data.name, data.rank);
        if (noteError) {
            errors.push(noteError);
        }
        completionError = await submitCompletion(row.url, row.dateCompleted, row.requirementNumber);
        if (completionError) {
            errors.push(completionError);
        }
    }
    if (errors.length > 0) {
        alert('There were errors during submission:\n' + errors.join('\n'));
    } else {
        alert('All data submitted successfully!');
    }
}

async function submitNote(note, rankRequirementID, requirementNumber, scoutUserId, name, rank) {
    if (note) {
        const noteData = {
            CommentType: 'RankRequirement',
            TypeID: rankRequirementID,
            TypeID2: '',
            Title: name + "'s " + rank + ' #' + requirementNumber,
            ScoutUserID: scoutUserId,
            Body: 'Approved by ' + note
        };
        const formBody = new URLSearchParams(noteData).toString();
        try {
            const response = await fetch(
                'https://scoutbook.scouting.org/mobile/includes/ajax.asp?Action=PostComment&HistoryID=',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                    body: formBody
                }
            );

            if (!response.ok) {
                console.error(`HTTP error! Status: ${response.status}`);
                return `Error posting note for #${requirementNumber}: ${response.statusText}`;
            }

            const responseText = await response.text(); // or response.text(), depending on server
            if (!responseText.includes('GetComment&CommentID=')) {
                console.error(`Error posting note for #${requirementNumber} - Unexpected response text: ${responseText}`);
                return `Error posting note for #${requirementNumber} - Unexpected response text: ${responseText}`;
            }
        } catch (error) {
            console.error('Error posting form:', error);
            return `Error posting note for #${requirementNumber}: ${error}`;
        }
    }
    return;
}

async function submitCompletion(url, dateCompleted, requirementNumber) {
    if (dateCompleted) {
        const completedData = {
            Action: 'SubmitDateCompleted',
            DateCompleted: dateCompleted,
            LeaderApproved: '1'
        };
        const formBody = new URLSearchParams(completedData).toString();
        try {
            const response = await fetch(url,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                    body: formBody
                }
            );

            if (!response.ok) {
                console.error(`HTTP error! Status: ${response.status}`);
                return `Error posting completion for #${requirementNumber}: ${response.statusText}`;
            }

            const responseText = await response.text(); // or response.text(), depending on server
            if (!responseText.includes('$.mobile.changePage(\'/mobile/dashboard/admin/advancement/rank.asp')) {
                console.error(`Error posting completion for #${requirementNumber} - Unexpected response text: ${responseText}`);
               return `Error posting completion for #${requirementNumber} - Unexpected response text: ${responseText}`;
            }
        } catch (error) {
            console.error('Error posting form:', error);
            return `Error posting note for #${requirementNumber}: ${error}`;
        }
    }
    return;
}