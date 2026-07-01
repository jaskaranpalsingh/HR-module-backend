import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // 10 second timeout
      socketTimeoutMS: 45000,
    });
    console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.error('⚠️  Server will continue running but DB operations will fail.');
    console.error('   → Check your Atlas IP whitelist at cloud.mongodb.com');
    console.error('   → Or resume your cluster if it is paused');
    // Do NOT exit — keep server alive for debugging
  }
};

export default connectDB;
