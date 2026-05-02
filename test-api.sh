#!/bin/bash

echo "🚀 Testing Notification API Endpoints"
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to make API request
make_request() {
    local method=$1
    local url=$2
    local data=$3
    local description=$4

    echo -e "\n${BLUE}=== $description ===${NC}"
    echo -e "${YELLOW}$method $url${NC}"

    if [ -n "$data" ]; then
        echo -e "${GREEN}Request Body:${NC}"
        echo "$data" | jq '.' 2>/dev/null || echo "$data"
        echo ""
    fi

    # Make the request
    if [ "$method" = "POST" ]; then
        response=$(curl -s -X POST "http://localhost:5000$url" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null)
    else
        response=$(curl -s "http://localhost:5000$url" 2>/dev/null)
    fi

    # Check if curl succeeded
    if [ $? -eq 0 ] && [ -n "$response" ]; then
        echo -e "${GREEN}Response:${NC}"
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
    else
        echo -e "${RED}Error: Unable to connect to server${NC}"
        echo "Make sure the notification service is running on port 5000"
    fi

    echo -e "${BLUE}$(printf '%.0s=' {1..50})${NC}"
}

# Test data
NOTIFICATION_1='{
  "userId": "user-123",
  "type": "placement",
  "title": "Job Offer from Tech Corp",
  "message": "Congratulations! You have received a job offer from Tech Corp for the Software Engineer position with a salary of 12 LPA.",
  "priority": "urgent",
  "metadata": {
    "companyName": "Tech Corp",
    "salary": "12 LPA",
    "position": "Software Engineer"
  }
}'

NOTIFICATION_2='{
  "userId": "user-456",
  "type": "interview",
  "title": "Interview Scheduled with Google",
  "message": "Your technical interview with Google is scheduled for tomorrow at 2 PM. Please be prepared with your resume and portfolio.",
  "priority": "high",
  "metadata": {
    "companyName": "Google",
    "date": "2026-05-03",
    "time": "2:00 PM",
    "round": "Technical Round 1"
  }
}'

NOTIFICATION_3='{
  "userId": "user-789",
  "type": "event",
  "title": "Microsoft Placement Drive",
  "message": "Microsoft placement drive scheduled for next week. All eligible students are requested to register through the placement portal.",
  "priority": "medium",
  "metadata": {
    "companyName": "Microsoft",
    "date": "2026-05-10",
    "venue": "Main Auditorium",
    "registrationDeadline": "2026-05-05"
  }
}'

# Make API requests
make_request "POST" "/api/v1/notifications" "$NOTIFICATION_1" "Create Placement Notification"
sleep 1

make_request "POST" "/api/v1/notifications" "$NOTIFICATION_2" "Create Interview Notification"
sleep 1

make_request "POST" "/api/v1/notifications" "$NOTIFICATION_3" "Create Event Notification"
sleep 1

make_request "GET" "/api/v1/notifications/user-123?page=1&limit=10" "" "Get User Notifications"
sleep 1

make_request "GET" "/api/v1/notifications/user-123/priority-inbox?limit=5" "" "Get Priority Inbox"
sleep 1

make_request "GET" "/api/v1/notifications/user-123/priority-stats" "" "Get Priority Statistics"
sleep 1

make_request "GET" "/api/v1/templates" "" "List Available Templates"
sleep 1

# Template-based notification
TEMPLATE_NOTIFICATION='{
  "templateId": "interview-scheduled",
  "userId": "user-999",
  "variables": {
    "companyName": "Amazon",
    "date": "2026-05-15",
    "time": "10:00 AM"
  }
}'

make_request "POST" "/api/v1/notifications/from-template" "$TEMPLATE_NOTIFICATION" "Create Notification from Template"

echo -e "\n${GREEN}✅ API Testing Complete!${NC}"
echo "📸 Take screenshots of the terminal output above"
echo "💡 Each request shows: method, URL, request body (if POST), and response"