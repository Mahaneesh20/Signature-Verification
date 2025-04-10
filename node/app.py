from flask import Flask, request, jsonify
import base64
import numpy as np
from PIL import Image
import io
import tensorflow as tf

app = Flask(__name__)

# Load your trained CNN model
try:
    model = tf.keras.models.load_model(r'C:\Users\lucky\New project\node\signature_comparison_model.h5')
    print("Model loaded successfully.")
except Exception as e:
    print(f"Error loading model: {str(e)}")
    model = None

@app.route('/api/verify-signature', methods=['POST'])
def verify_signature():
    try:
        print("Request received")
        
        # Get the data from the request
        data = request.get_json()  # Receive the JSON data
        if not data or 'uploaded_image' not in data or 'real_image' not in data:
            print("Missing required fields in data")
            return jsonify({"error": "Missing required fields 'uploaded_image' or 'real_image'"}), 400

        uploaded_image_base64 = data['uploaded_image']
        real_image_base64 = data['real_image']

        try:
            print("Decoding Base64 images")
            # Decode the Base64-encoded images
            uploaded_image_data = base64.b64decode(uploaded_image_base64)
            real_image_data = base64.b64decode(real_image_base64)
        except Exception as e:
            print(f"Base64 decoding failed: {str(e)}")
            return jsonify({'error': f"Base64 decoding failed: {str(e)}"}), 400

        try:
            print("Opening images as PIL")
            # Convert to PIL Image
            uploaded_image = Image.open(io.BytesIO(uploaded_image_data))
            real_image = Image.open(io.BytesIO(real_image_data))
        except Exception as e:
            print(f"Error opening image: {str(e)}")
            return jsonify({'error': f"Error opening image: {str(e)}"}), 400

        try:
            print("Resizing images")
            # Resize images to the input size expected by the model
            uploaded_image = uploaded_image.resize((224, 224))
            real_image = real_image.resize((224, 224))
        except Exception as e:
            print(f"Error resizing image: {str(e)}")
            return jsonify({'error': f"Error resizing image: {str(e)}"}), 400

        try:
            print("Converting images to numpy arrays and normalizing")
            # Convert images to numpy arrays and normalize
            uploaded_image = np.array(uploaded_image) / 255.0
            real_image = np.array(real_image) / 255.0
        except Exception as e:
            print(f"Error processing image: {str(e)}")
            return jsonify({'error': f"Error processing image: {str(e)}"}), 400

        # Expand dimensions to match model input
        uploaded_image = np.expand_dims(uploaded_image, axis=0)
        real_image = np.expand_dims(real_image, axis=0)

        if model is None:
            print("Model is not loaded successfully")
            return jsonify({'error': 'Model not loaded successfully'}), 500

        try:
            print("Making predictions")
            # Pass both images as inputs to the model
            prediction = model.predict([uploaded_image, real_image])  # Pass as a list
        except Exception as e:
            print(f"Model prediction failed: {str(e)}")
            return jsonify({'error': f"Model prediction failed: {str(e)}"}), 500

        # Assuming the model output is a binary prediction (valid or invalid)
        result = 'Valid' if prediction[0] > 0.9 else 'Invalid'

        print(f"Prediction result: {result}")
        return jsonify({"prediction": result})

    except Exception as e:
        # Catch any unhandled exceptions
        print(f"Unexpected error: {str(e)}")
        return jsonify({'error': f"An unexpected error occurred: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(debug=True)
