const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Vapi webhook endpoint
app.post('/', (req, res) => {
  const { message } = req.body;
  
  if (message.type === 'tool-calls') {
    const toolCall = message.toolCallList[0];
    
    if (toolCall.function.name === 'save_appointment_booking') {
      const bookingData = toolCall.function.arguments;
      
      console.log('📅 New Booking Received:');
      console.log(JSON.stringify(bookingData, null, 2));
      
      // TODO: Save to your database here
      
      // Respond to Vapi
      res.json({
        results: [{
          toolCallId: toolCall.id,
          result: 'Appointment successfully booked!'
        }]
      });
    }
  } else {
    res.json({ ok: true });
  }
});

app.listen(4350, () => {
  console.log('🚀 Vapi webhook server running on http://localhost:4350');
});