const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const axios = require('axios');

const app = express();
const port = 8000;


app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(cookieParser())
app.use(express.static(path.join(__dirname,'public')))
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


mongoose.connect('mongodb+srv://aakitimahaneesh2006:pNx.g9bLhL3ZCA9@registration.0tr5o.mongodb.net/')
    .then(() => console.log('MongoDB connected...'))
    .catch(err => console.log(err));


const userSchema = new mongoose.Schema({
    fname: { type: String, required: true },
    lname: { type: String, required: true },
    Acc_num: { type: String, required: true, unique: true },
    real_image: { 
        data: { type: String, required: true },   // Base64 string for the real image
        contentType: { type: String, required: true }  // MIME type for the real image
      }, // Base64 image data
});


const emp_scheme = new mongoose.Schema({
    fname: { type: String, required: true },
    lname: { type: String, required: true },
    emp_id: {type:String,required:true},
    pass:{ type: String, required: true},
    images: [{
        data: { type: String, required: true },   // Base64 string of the image data
        contentType: { type: String, required: true }  // MIME type of the image (e.g., image/png, image/jpeg)
      }],
    prediction: [{type: String,required:true}],
});

// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//       cb(null, './uploads')
//     },
//     filename: function (req, file, cb) {
//       cb(null, Date.now() +' '+ file.originalname )
//     }
//   })


const storage = multer.memoryStorage(); // Use memoryStorage to keep file in memory

const uploadMultiple = multer({ storage: storage }).array('images', 10); // Allow up to 10 images

  
const upload = multer({ storage: storage })

const User = mongoose.model('User', userSchema);

const bank_emp = mongoose.model('Emp',emp_scheme);

const jwt=require('jsonwebtoken');
const { type } = require('os');
const { realpath } = require('fs');
const secret="7893218343"
function setUser(user) {
   
   return jwt.sign({

    id: user._id,

},secret
);
}
function getUser(token) {
    if (!token) return null;
    try {
        return jwt.verify(token, secret);
    } catch (err) {
        console.error("Invalid token:", err.message); // Log the error for debugging
        return null;
    }
}


async function restrict(req, res, next) {
    const userUid = req.cookies?.uid;
    if (!userUid) {
        console.log("No user token found, redirecting to login.");
        return res.redirect("/api/login");
    }
    const user = getUser(userUid);
    if (!user) {
        console.log("Invalid or expired token, redirecting to login.");
        return res.redirect("/api/login");
    }
    req.user = user;
    console.log("User verified:", user); // Debug: Confirm user data
    next();
}


app.set("view engine", "ejs");
app.set("views", path.resolve("./views"));

app.get("/api/home", (req, res) => {
    return res.render('home');
});

app.get("/api/signup", (req, res) => {
    return res.render("check");
});

app.post('/api/signup', async (req, res) => {
    const { fname, lname, emp_id, pass } = req.body;
    try {
        const existingUser = await bank_emp.findOne({ emp_id });
        if (existingUser) {
            return res.json({ success: false, message: "Employee already exists" });
        }
        await bank_emp.create({ fname, lname, emp_id, pass });
        return res.json({ success: true });
    } catch (error) {
        console.error("Signup Error:", error.message);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});



app.get('/api/login', (req, res) => {
    res.render('check');
});

app.post('/api/login', async (req, res) => {
    const { emp_id, pass} = req.body;
    try {
        const emp = await bank_emp.findOne({ emp_id, pass });
        if (emp) {
            const token=setUser(emp);
            res.cookie('uid', token, { httpOnly: true, maxAge: 3600000 });

            return res.json({ success: true});
        } else {
            return res.json({ success: false, message: "Invalid username or password" });
        }
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.get("/api/dashboard", restrict, (req, res) => {
    res.render('dashboard');
});
// app.post('/api/dashboard', restrict, upload.single('image'), async (req, res) => {
//     try {
//         if (!req.file) {
//             return res.status(400).json({ message: "File upload failed" });
//         }
        
//         const { path, filename } = req.file;
//         const image = req.file;
//         const userId = req.user.id;

//         const formData = new FormData();
//         formData.append('image', image.buffer, image.originalname);

//          // Make the request to Flask API
//         const response = await axios.post('http://127.0.0.1:5000/predict', formData, {
//         headers: {
//           'Content-Type': 'multipart/form-data'
//         }
//         });

//             // Get the prediction from Flask
//         const prediction = response.data.prediction;


//         const updateResult = await User.findByIdAndUpdate(
//             userId,
//             { $push: { path: path, filename: filename } },
//             { new: true } 
//         );
//         if (!updateResult) {
//             return res.status(400).json({ message: "User not found" });
//         }
//         console.log("File uploaded and saved:", req.file);

//         return res.json({
//             success: true,
//             filename: filename,
//             prediction: prediction // send prediction data to frontend
//         });
//     } catch (error) {
//         console.error("Error updating user with file data:", error.message);
//         res.status(500).json({ message: "Internal Server Error" });
//     }
// });

app.post('/api/dashboard', restrict, upload.single('image'), async (req, res) => {
    try {
        // Check if the file is present
        if (!req.file) {
            return res.status(400).json({ message: "File upload failed" });
        }

        // Convert file to Base64
        const { buffer, mimetype } = req.file;
        const base64Image = buffer.toString('base64');

        // Prepare image data for database
        const imageData = {
            data: base64Image,
            contentType: mimetype,
        };

        // Get the logged-in bank employee's ID
        const bankEmployee = await bank_emp.findById(req.user.id); // Find by ID from token

        if (!bankEmployee) {
            return res.status(404).json({ message: "Bank employee not found" });
        }

        // console.log("Bank Employee found:", bankEmployee);

        // Update the bank employee's images array
        const updatedBankEmployee = await bank_emp.findByIdAndUpdate(
            req.user.id, // Use ID from the token
            { $push: { images: imageData } }, // Push the image data into the images array
            { new: true } // Return the updated document
        );

        if (!updatedBankEmployee) {
            return res.status(500).json({ message: "Failed to update bank employee" });
        }
        email = req.body.email
        const customer = await User.findOne({email})

        // Send the image data to Flask for signature verification
        const dataToSend = {
            uploaded_image: base64Image, // Add the uploaded image Base64
            real_image: customer.real_image.data, // Customer's real image Base64
            email: email,// Include the email
        };

        const flaskResponse = await fetch('http://localhost:5000/api/verify-signature', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dataToSend),
        });

        const flaskResult = await flaskResponse.json();
        const result = flaskResult.prediction || 'Verification Failed';

        await bank_emp.findByIdAndUpdate(req.user.id, { $push: { prediction: result } });
        // Return response including filename, prediction, and email
        return res.json({
            success: true,
            filename: req.file.originalname,
            prediction: result, // Include the verification result
            base64Image: `data:${mimetype};base64,${base64Image}`, // Include the email
        });
    } catch (error) {
        console.error("Error processing upload:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
});



app.post('/api/logout', (req, res) => {
    // Clear the JWT token cookie
    res.clearCookie('uid', {
        httpOnly: true, // Ensure secure handling
        secure: true,   // Use only with HTTPS
        sameSite: 'Strict' // Prevent CSRF
    });

    res.redirect('/api/login');
});


// app.get('/api/profile', restrict, async (req, res) => {
//     try {
//         const user = await User.findById(req.user.id);
//         if (!user) {
//             return res.status(404).send('User not found');
//         }
//         res.render('profile', {
//             username: user.fname + " " + user.lname,
//             email:user.email,
//             images: user.path
//         });
//     } catch (error) {
//         console.error("Error fetching user profile:", error.message);
//         res.status(500).send("Internal Server Error");
//     }
// });
app.get('/api/profile', restrict, async (req, res) => {
    try {
        console.log(req.user.id)
        const user = await bank_emp.findById(req.user.id);
        if (!user) {
            return res.status(404).send('User not found');
        }

        const images = (user.images || []).map((img, index) => ({
            src: `data:${img.contentType};base64,${img.data.toString('base64')}`,
            prediction: user.prediction && user.prediction[index] ? user.prediction[index] : "No prediction available",
        }));

        res.render('profile', {
            username: `${user.fname} ${user.lname}`,
            email: user.emp_id,
            images: images,  // Render images from the images array
        });
        
    } catch (error) {
        console.error("Error fetching user profile:", error.message);
        res.status(500).send("Internal Server Error");
    }
});




app.get("/api/check",(req,res)=>{
    res.render('check1',{username:req.user.username});
});

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});
