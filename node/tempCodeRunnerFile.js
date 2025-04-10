const images = (user.images || []).map((img, index) => ({
            src: `data:${img.contentType};base64,${img.data.toString('base64')}`,
            prediction: user.prediction && user.prediction[index] ? user.prediction[index] : "No prediction available",
        }));