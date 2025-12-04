async function fetchUserInfo(userId) {
    try {
        const response = await fetch(`https://api.lanyard.rest/v1/users/${userId}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching user information:', error);
    }
}

async function displayUserInfo(userId) {
    const userInfo = await fetchUserInfo(userId);
    const userInfoDiv = document.getElementById('discord-status');
    
    if (userInfo?.success) {
        const activities = userInfo.data.activities;
        const discordUser = userInfo.data.discord_user;
        
        // Display Discord username
        const usernameElement = document.createElement('p');
        usernameElement.textContent = `Username: ${discordUser.username}`;
        userInfoDiv.appendChild(usernameElement);
        
        // Display Discord status
        const statusElement = document.createElement('p');
        statusElement.textContent = `Status: ${userInfo.data.discord_status}`;
        userInfoDiv.appendChild(statusElement);

        // Display Discord avatar
        const avatarElement = document.createElement('img');
        avatarElement.src = `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`;
        userInfoDiv.appendChild(avatarElement);
        
        // Display activities
        if (activities.length > 0) {
            activities.forEach(activity => {
                const activityName = document.createElement('p');
                activityName.textContent = `Activity: ${activity.name}`;
                userInfoDiv.appendChild(activityName);
                const activityDetails = document.createElement('p');
                if (activity.details) {
                    activityDetails.textContent = `Details: ${activity.details}`;
                    userInfoDiv.appendChild(activityDetails);
                }
            });
        } else {
            const noActivityElement = document.createElement('p');
            noActivityElement.textContent = 'Not doing anything...';
            userInfoDiv.appendChild(noActivityElement);
        }
    } else {
        const errorElement = document.createElement('p');
        errorElement.textContent = 'Failed to fetch user information.';
        userInfoDiv.appendChild(errorElement);
    }
}