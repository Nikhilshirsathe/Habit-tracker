// Constants
const HABITS_KEY = 'habits';
const BEST_STREAK_KEY = 'bestStreak';
const GOALS_KEY = 'goals';
const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

// State
let habits = JSON.parse(localStorage.getItem(HABITS_KEY)) || [];
let bestStreak = parseInt(localStorage.getItem(BEST_STREAK_KEY)) || 0;
let currentFilter = 'all';
let currentSort = 'name';
let goals = JSON.parse(localStorage.getItem(GOALS_KEY)) || {
    daily: 3,
    weekly: 15,
    monthly: 60
};

// DOM Elements
const habitInput = document.getElementById('habit-input');
const addHabitBtn = document.getElementById('add-habit');
const habitsList = document.getElementById('habits-list');
const currentStreakEl = document.getElementById('current-streak');
const habitsTodayEl = document.getElementById('habits-today');
const bestStreakEl = document.getElementById('best-streak');
const streakProgress = document.getElementById('streak-progress');
const todayProgress = document.getElementById('today-progress');
const bestProgress = document.getElementById('best-progress');
const sortSelect = document.getElementById('sort-habits');
const dailyGoalEl = document.getElementById('daily-goal');
const weeklyGoalEl = document.getElementById('weekly-goal');
const monthlyGoalEl = document.getElementById('monthly-goal');

// Progress Graph
let progressChart = null;

// Calendar functionality
let currentDate = new Date();
let selectedHabit = null;

// Add selected habit state
let selectedHabitId = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    renderHabits();
    updateStats();
    updateGoals();
    initializeProgressGraph();
    initializeCalendar();
    setupEventListeners();
    updateHabitOptions();
});

// Event Listeners
function setupEventListeners() {
    addHabitBtn.addEventListener('click', addHabit);
    habitInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addHabit();
    });
    
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelector('.filter-btn.active').classList.remove('active');
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderHabits();
        });
    });
    
    // Sort select
    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderHabits();
    });

    // Goal inputs
    document.querySelectorAll('.goal-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const type = e.target.dataset.goalType;
            const value = parseInt(e.target.value);
            if (!isNaN(value) && value >= 0) {
                goals[type] = value;
                localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
                updateGoals();
            }
        });
    });
}

// Goal Management
function updateGoals() {
    const habits = JSON.parse(localStorage.getItem('habits') || '[]');
    const todayStr = TODAY.toISOString().split('T')[0];
    
    // If a habit is selected, only calculate goals for that habit
    const habitsToCalculate = selectedHabitId 
        ? habits.filter(habit => habit.id === selectedHabitId)
        : habits;
    
    if (habitsToCalculate.length === 0) {
        dailyGoalEl.innerHTML = `
            <span class="goal-progress">0/0</span>
            <input type="number" class="goal-input" data-goal-type="daily" value="0" min="0">
        `;
        weeklyGoalEl.innerHTML = `
            <span class="goal-progress">0/0</span>
            <input type="number" class="goal-input" data-goal-type="weekly" value="0" min="0">
        `;
        monthlyGoalEl.innerHTML = `
            <span class="goal-progress">0/0</span>
            <input type="number" class="goal-input" data-goal-type="monthly" value="0" min="0">
        `;
        return;
    }
    
    const completedToday = habitsToCalculate.filter(habit => habit.days[todayStr]).length;
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date();
    monthStart.setDate(1);
    
    const completedThisWeek = habitsToCalculate.filter(habit => 
        Object.keys(habit.days).some(date => 
            new Date(date) >= weekStart && new Date(date) <= new Date()
        )
    ).length;
    
    const completedThisMonth = habitsToCalculate.filter(habit => 
        Object.keys(habit.days).some(date => 
            new Date(date) >= monthStart && new Date(date) <= new Date()
        )
    ).length;
    
    dailyGoalEl.innerHTML = `
        <span class="goal-progress">${completedToday}/${goals.daily}</span>
        <input type="number" class="goal-input" data-goal-type="daily" value="${goals.daily}" min="0">
    `;
    weeklyGoalEl.innerHTML = `
        <span class="goal-progress">${completedThisWeek}/${goals.weekly}</span>
        <input type="number" class="goal-input" data-goal-type="weekly" value="${goals.weekly}" min="0">
    `;
    monthlyGoalEl.innerHTML = `
        <span class="goal-progress">${completedThisMonth}/${goals.monthly}</span>
        <input type="number" class="goal-input" data-goal-type="monthly" value="${goals.monthly}" min="0">
    `;
    
    // Update progress bars
    document.getElementById('daily-progress').style.width = `${(completedToday / goals.daily) * 100}%`;
    document.getElementById('weekly-progress').style.width = `${(completedThisWeek / goals.weekly) * 100}%`;
    document.getElementById('monthly-progress').style.width = `${(completedThisMonth / goals.monthly) * 100}%`;
}

// Enhanced Habit Management
function addHabit() {
    const name = habitInput.value.trim();
    if (name) {
        const newHabit = {
            id: Date.now(),
            name,
            days: {},
            createdAt: new Date().toISOString(),
            completed: false,
            category: 'general',
            priority: 'medium',
            notes: ''
        };
        habits.push(newHabit);
        saveHabits();
        renderHabits();
        updateStats();
        updateGoals();
        habitInput.value = '';
        showNotification('Habit added successfully!', 'success');
    }
}

function deleteHabit(id) {
    if (confirm('Are you sure you want to delete this habit?')) {
        habits = habits.filter(habit => habit.id !== id);
        saveHabits();
        renderHabits();
        updateStats();
        updateGoals();
        showNotification('Habit deleted successfully!', 'info');
    }
}

function editHabit(id, newName, category, priority, notes) {
    const habit = habits.find(h => h.id === id);
    if (habit) {
        habit.name = newName;
        habit.category = category;
        habit.priority = priority;
        habit.notes = notes;
        saveHabits();
        renderHabits();
        showNotification('Habit updated successfully!', 'success');
    }
}

function toggleHabitDay(habitId, date) {
    const habits = JSON.parse(localStorage.getItem('habits') || '[]');
    const habit = habits.find(h => h.id === habitId);
    
    if (habit) {
        if (habit.days[date]) {
            delete habit.days[date];
        } else {
            habit.days[date] = true;
        }
        localStorage.setItem('habits', JSON.stringify(habits));
        renderHabits();
        updateStats();
        updateProgressGraph();
    }
}

function toggleHabitCompletion(id) {
    const habit = habits.find(h => h.id === id);
    if (habit) {
        habit.completed = !habit.completed;
        saveHabits();
        renderHabits();
        updateStats();
    }
}

// Enhanced Rendering
function renderHabits() {
    const habitsList = document.getElementById('habits-list');
    habitsList.innerHTML = '';
    
    const habits = JSON.parse(localStorage.getItem('habits') || '[]');
    const weekDates = getCurrentWeekDates();
    const todayStr = TODAY.toISOString().split('T')[0];
    
    // If a habit is selected, only show that habit
    const habitsToShow = selectedHabitId 
        ? habits.filter(habit => habit.id === selectedHabitId)
        : habits;
    
    habitsToShow.forEach(habit => {
        const habitCard = document.createElement('div');
        habitCard.className = 'habit-card';
        
        const isCompleted = habit.days[todayStr] || false;
        const streak = calculateStreak(habit.days);
        const completionRate = calculateCompletionRate(habit.days);
        
        // Create week view
        const weekView = weekDates.map(date => {
            const isDateCompleted = habit.days[date] || false;
            const isToday = date === todayStr;
            const dateObj = new Date(date);
            const formattedDate = dateObj.toLocaleDateString('en-US', { 
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });
            return `
                <div class="habit-day ${isDateCompleted ? 'checked' : ''} ${isToday ? 'today' : ''}" 
                     data-date="${date}"
                     title="${formattedDate}"
                     onclick="handleDayClick(${habit.id}, '${date}')">
                    ${dateObj.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
            `;
        }).join('');
        
        habitCard.innerHTML = `
            <div class="habit-header">
                <h3 class="habit-title">${habit.name}</h3>
                <div class="habit-actions">
                    <button class="complete-btn ${isCompleted ? 'completed' : ''}" 
                            onclick="toggleHabitDay(${habit.id}, '${todayStr}')">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="delete-btn" onclick="deleteHabit(${habit.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="habit-days">
                ${weekView}
            </div>
            <div class="habit-stats">
                <span class="streak"><i class="fas fa-fire"></i> ${streak} day${streak !== 1 ? 's' : ''}</span>
                <span class="completion-rate"><i class="fas fa-chart-line"></i> ${completionRate}%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${completionRate}%"></div>
            </div>
        `;
        
        habitsList.appendChild(habitCard);
    });
}

// Utility Functions
function saveHabits() {
    localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
    updateHabitOptions();
    if (progressChart) {
        const timeframe = document.getElementById('graph-timeframe').value;
        updateGraph(timeframe);
    }
}

function calculateStreak(days) {
    // Get all completed dates and sort them in descending order
    const completedDates = Object.keys(days)
        .filter(date => days[date]) // Only get dates that are marked as completed
        .map(date => new Date(date))
        .sort((a, b) => b - a); // Sort in descending order (newest first)
    
    if (completedDates.length === 0) return 0;
    
    let streak = 0;
    let currentDate = new Date(TODAY);
    currentDate.setHours(0, 0, 0, 0);
    
    // Check if today is completed
    const todayStr = currentDate.toISOString().split('T')[0];
    if (days[todayStr]) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
    }
    
    // Check consecutive days backwards
    while (true) {
        const dateStr = currentDate.toISOString().split('T')[0];
        if (days[dateStr]) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
        } else {
            break;
        }
    }
    
    return streak;
}

function calculateCompletionRate(days) {
    const totalDays = Object.keys(days).length;
    const completedDays = Object.values(days).filter(Boolean).length;
    return totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;
}

function getLastSevenDays() {
    const days = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        days.push(date.toISOString().split('T')[0]);
    }
    
    return days;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function getDayInitial(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' })[0];
}

function updateStats() {
    const habits = JSON.parse(localStorage.getItem('habits') || '[]');
    const todayStr = TODAY.toISOString().split('T')[0];
    
    // If a habit is selected, only calculate stats for that habit
    const habitsToCalculate = selectedHabitId 
        ? habits.filter(habit => habit.id === selectedHabitId)
        : habits;
    
    if (habitsToCalculate.length === 0) {
        currentStreakEl.textContent = '0 days';
        streakProgress.style.width = '0%';
        bestStreakEl.textContent = '0 days';
        bestProgress.style.width = '0%';
        habitsTodayEl.textContent = '0/0';
        todayProgress.style.width = '0%';
        return;
    }
    
    // Current streak (longest streak among selected habits)
    const currentStreak = Math.max(...habitsToCalculate.map(habit => calculateStreak(habit.days)));
    currentStreakEl.textContent = `${currentStreak} day${currentStreak !== 1 ? 's' : ''}`;
    streakProgress.style.width = `${(currentStreak / Math.max(bestStreak, 1)) * 100}%`;
    
    // Update best streak if current streak is higher
    if (currentStreak > bestStreak) {
        bestStreak = currentStreak;
        localStorage.setItem(BEST_STREAK_KEY, bestStreak);
    }
    bestStreakEl.textContent = `${bestStreak} day${bestStreak !== 1 ? 's' : ''}`;
    bestProgress.style.width = '100%';
    
    // Habits completed today
    const completedToday = habitsToCalculate.filter(habit => habit.days[todayStr]).length;
    const totalHabits = habitsToCalculate.length;
    habitsTodayEl.textContent = `${completedToday}/${totalHabits}`;
    todayProgress.style.width = totalHabits > 0 ? `${(completedToday / totalHabits) * 100}%` : '0%';
}

function editHabitPrompt(id) {
    const habit = habits.find(h => h.id === id);
    if (habit) {
        const newName = prompt('Edit habit name:', habit.name);
        if (newName && newName.trim()) {
            const category = prompt('Category (e.g., Health, Work, Personal):', habit.category);
            const priority = prompt('Priority (high/medium/low):', habit.priority);
            const notes = prompt('Notes:', habit.notes);
            editHabit(id, newName.trim(), category, priority, notes);
        }
    }
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
        ${message}
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function showNotes(id) {
    const notesEl = document.getElementById(`notes-${id}`);
    notesEl.style.display = notesEl.style.display === 'none' ? 'block' : 'none';
}

// Social Sharing
function shareOnSocial(platform) {
    const text = `Check out my habit tracking progress! I've maintained a ${bestStreak}-day streak!`;
    const url = window.location.href;
    
    let shareUrl;
    switch (platform) {
        case 'twitter':
            shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
            break;
        case 'facebook':
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
            break;
        case 'linkedin':
            shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
            break;
    }
    
    window.open(shareUrl, '_blank', 'width=600,height=400');
}

// Progress Graph
function initializeProgressGraph() {
    const ctx = document.getElementById('progressChart').getContext('2d');
    const timeframeSelect = document.getElementById('graph-timeframe');
    
    function updateGraph(timeframe) {
        const data = getProgressData(timeframe);
        
        if (progressChart) {
            progressChart.destroy();
        }
        
        progressChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        label: 'Completed Habits',
                        data: data.completed,
                        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--primary-color'),
                        backgroundColor: 'rgba(108, 92, 231, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Total Habits',
                        data: data.total,
                        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--secondary-color'),
                        backgroundColor: 'rgba(91, 106, 240, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'var(--text-color)'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'var(--text-color)'
                        }
                    }
                }
            }
        });
    }
    
    timeframeSelect.addEventListener('change', () => {
        updateGraph(timeframeSelect.value);
    });
    
    // Initial graph
    updateGraph('week');
}

function getProgressData(timeframe, habitId = 'all') {
    const today = new Date();
    let labels = [];
    let completed = [];
    let total = [];
    
    // Use selected habit if available, otherwise use the provided habitId
    const selectedHabit = selectedHabitId 
        ? habits.find(h => h.id === selectedHabitId)
        : (habitId === 'all' ? null : habits.find(h => h.id === parseInt(habitId)));
    
    switch (timeframe) {
        case 'week':
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(today.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                
                labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
                if (selectedHabit) {
                    completed.push(selectedHabit.days[dateStr] ? 1 : 0);
                    total.push(1);
                } else {
                    completed.push(habits.filter(h => h.days[dateStr]).length);
                    total.push(habits.length);
                }
            }
            break;
            
        case 'month':
            for (let i = 29; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(today.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                
                labels.push(date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }));
                if (selectedHabit) {
                    completed.push(selectedHabit.days[dateStr] ? 1 : 0);
                    total.push(1);
                } else {
                    completed.push(habits.filter(h => h.days[dateStr]).length);
                    total.push(habits.length);
                }
            }
            break;
            
        case 'year':
            for (let i = 11; i >= 0; i--) {
                const date = new Date(today);
                date.setMonth(today.getMonth() - i);
                const monthStr = date.toLocaleDateString('en-US', { month: 'short' });
                
                let monthCompleted = 0;
                const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
                
                for (let day = 1; day <= daysInMonth; day++) {
                    const dayDate = new Date(date.getFullYear(), date.getMonth(), day);
                    const dayStr = dayDate.toISOString().split('T')[0];
                    if (selectedHabit) {
                        monthCompleted += selectedHabit.days[dayStr] ? 1 : 0;
                    } else {
                        monthCompleted += habits.filter(h => h.days[dayStr]).length;
                    }
                }
                
                labels.push(monthStr);
                completed.push(monthCompleted);
                total.push(selectedHabit ? daysInMonth : habits.length * daysInMonth);
            }
            break;
    }
    
    return { labels, completed, total };
}

// Calendar functionality
function initializeCalendar() {
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');
    const calendarToggle = document.getElementById('calendar-toggle');
    const calendarSidebar = document.querySelector('.calendar-sidebar');
    
    // Ensure calendar is closed by default
    calendarSidebar.classList.remove('open');
    
    // Add click event to toggle button
    calendarToggle.addEventListener('click', () => {
        calendarSidebar.classList.toggle('open');
    });
    
    // Add click events to month navigation buttons
    prevMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });
    
    nextMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });
    
    // Initial render
    renderCalendar();
}

function renderCalendar() {
    const calendarDays = document.getElementById('calendar-days');
    const currentMonthEl = document.getElementById('current-month');
    
    // Update month header
    currentMonthEl.textContent = currentDate.toLocaleDateString('en-US', { 
        month: 'long', 
        year: 'numeric' 
    });
    
    // Clear previous days
    calendarDays.innerHTML = '';
    
    // Get first day of month and last day of month
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    // Get days from previous month to fill the first week
    const firstDayOfWeek = firstDay.getDay();
    const prevMonthLastDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0).getDate();
    
    // Add days from previous month
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const day = document.createElement('div');
        day.className = 'calendar-day other-month';
        day.textContent = prevMonthLastDay - i;
        calendarDays.appendChild(day);
    }
    
    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
        const day = document.createElement('div');
        day.className = 'calendar-day';
        day.textContent = i;
        
        const currentDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
        const dateStr = currentDay.toISOString().split('T')[0];
        day.setAttribute('data-date', dateStr);
        
        // Check if it's today
        if (currentDay.getTime() === TODAY.getTime()) {
            day.classList.add('today');
            // Only add click event for today
            day.addEventListener('click', () => handleDayClick(day));
        } else {
            // For all other days, add the past class
            day.classList.add('past');
            day.style.opacity = '0.7';
            day.style.cursor = 'not-allowed';
        }
        
        // Set completion status
        updateDayStatus(day, dateStr);
        
        calendarDays.appendChild(day);
    }
    
    // Add days from next month to complete the last week
    const remainingDays = 42 - (firstDayOfWeek + lastDay.getDate());
    for (let i = 1; i <= remainingDays; i++) {
        const day = document.createElement('div');
        day.className = 'calendar-day other-month';
        day.textContent = i;
        calendarDays.appendChild(day);
    }
}

function updateDayStatus(dayElement, dateStr) {
    const completedHabits = habits.filter(h => h.days[dateStr]).length;
    const totalHabits = habits.length;
    
    if (completedHabits === totalHabits && totalHabits > 0) {
        dayElement.classList.add('completed');
    } else if (completedHabits > 0) {
        dayElement.classList.add('partial');
    } else if (totalHabits > 0) {
        dayElement.classList.add('missed');
    }
}

function handleDayClick(habitId, date) {
    const dateObj = new Date(date);
    const today = new Date(TODAY);
    
    // Reset time components for accurate comparison
    dateObj.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    // Only allow marking today's date as complete
    if (dateObj.getTime() === today.getTime()) {
        toggleHabitDay(habitId, date);
        showNotification(`Marked as complete for ${dateObj.toLocaleDateString('en-US', { 
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        })}`, 'success');
    } else {
        showNotification('You can only mark today\'s date as complete', 'info');
    }
}

function updateProgressGraph() {
    if (progressChart) {
        const timeframe = document.getElementById('graph-timeframe').value;
        updateGraph(timeframe);
    }
}

function updateHabitOptions() {
    const graphHabitSelect = document.getElementById('graph-habit');
    graphHabitSelect.innerHTML = '<option value="all">All Habits</option>';
    
    habits.forEach(habit => {
        const option = document.createElement('option');
        option.value = habit.id;
        option.textContent = habit.name;
        graphHabitSelect.appendChild(option);
    });
    
    graphHabitSelect.addEventListener('change', () => {
        selectedHabitId = graphHabitSelect.value === 'all' ? null : parseInt(graphHabitSelect.value);
        renderHabits();
        updateStats();
        updateProgressGraph();
    });
}

function updateGraph(timeframe) {
    const graphHabitSelect = document.getElementById('graph-habit');
    const selectedHabitId = graphHabitSelect.value;
    const data = getProgressData(timeframe, selectedHabitId);
    
    if (progressChart) {
        progressChart.destroy();
    }
    
    const ctx = document.getElementById('progressChart').getContext('2d');
    progressChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: 'Completed Habits',
                    data: data.completed,
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--primary-color'),
                    backgroundColor: 'rgba(108, 92, 231, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Total Habits',
                    data: data.total,
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--secondary-color'),
                    backgroundColor: 'rgba(91, 106, 240, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'var(--text-color)'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'var(--text-color)'
                    }
                }
            }
        }
    });
}

// Update the date check function
function updateDate() {
    const newToday = new Date();
    newToday.setHours(0, 0, 0, 0);
    
    if (newToday.getTime() !== TODAY.getTime()) {
        TODAY.setTime(newToday.getTime());
        renderCalendar();
        renderHabits();
        updateStats();
        updateProgressGraph();
        // Force a refresh of the week view
        const weekDates = getCurrentWeekDates();
        document.querySelectorAll('.habit-day').forEach(day => {
            const date = day.getAttribute('data-date');
            if (date === TODAY.toISOString().split('T')[0]) {
                day.classList.add('today');
            } else {
                day.classList.remove('today');
            }
        });
    }
}

// Call updateDate more frequently to ensure real-time updates
setInterval(updateDate, 1000); // Check every second

function getCurrentWeekDates() {
    const dates = [];
    const today = new Date(TODAY);
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek;
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(diff + i);
        dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
} 