import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css'; // Import the custom CSS file

const App = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    repeatPassword: '',
    idFrontUri: '',
    idBackUri: '',
    selfieUri: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [tempUri, setTempUri] = useState(null);

  // Terms & Conditions and Modal states for Step 5.
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);

  // Photo Conditions modal state (for Steps 2–4).
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  // State to hold validation result per photo (keyed by photo field name).
  const [photoValidation, setPhotoValidation] = useState({});

  // Lock body scroll when either modal is open.
  useEffect(() => {
    if (isTermsModalOpen || isPhotoModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isTermsModalOpen, isPhotoModalOpen]);

  // Function to initialize the camera.
  const startCamera = () => {
    if (navigator.mediaDevices) {
      const constraints = {
        video: { facingMode: step === 4 ? 'user' : 'environment' },
        audio: true
      };
      navigator.mediaDevices.getUserMedia(constraints)
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
        })
        .catch(err => console.error("Error starting camera:", err));
    }
  };

  // Activate camera on steps 2-4.
  useEffect(() => {
    if (step >= 2 && step <= 4) {
      startCamera();
    }
    // Cleanup camera on unmount or when step changes.
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, [step]);

  // Helper function that uses OpenCV.js to check image quality.
  const checkImageQuality = (imageDataUrl) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Read the image into a cv.Mat
        const mat = cv.imread(img);
        // Convert to grayscale
        let gray = new cv.Mat();
        cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);
        // Compute the Laplacian
        let laplacian = new cv.Mat();
        cv.Laplacian(gray, laplacian, cv.CV_64F);
        // Compute standard deviation (and then variance)
        let mean = new cv.Mat(), stddev = new cv.Mat();
        cv.meanStdDev(laplacian, mean, stddev);
        const variance = stddev.data64F[0] * stddev.data64F[0];
        // Clean up Mats
        mat.delete(); gray.delete(); laplacian.delete(); mean.delete(); stddev.delete();
        resolve(variance);
      };
      img.onerror = (err) => reject(err);
      img.src = imageDataUrl;
    });
  };

  // Validate photo using a simple OpenCV.js quality check.
  const validatePhoto = async (imageData, photoType) => {
    try {
      const variance = await checkImageQuality(imageData);
      const THRESHOLD = 100; // Experimentally determined threshold; adjust as needed.
      if (variance < THRESHOLD) {
        return { valid: false, errors: ["Image appears too blurry. Please retake the photo."] };
      } else {
        return { valid: true, errors: [] };
      }
    } catch (error) {
      return { valid: false, errors: ["Error processing image quality. Please try again."] };
    }
  };

  // Validate the image for steps 2-4.
  useEffect(() => {
    if (step >= 2 && step <= 4) {
      const photoKey = step === 2 ? 'idFrontUri' : step === 3 ? 'idBackUri' : 'selfieUri';
      const photoType = step === 4 ? "selfie" : "id";
      const image = tempUri || formData[photoKey];
      if (image && !photoValidation[photoKey]) {
        validatePhoto(image, photoType).then(result => {
          setPhotoValidation(prev => ({ ...prev, [photoKey]: result }));
        });
      }
    }
  }, [step, tempUri, formData, photoValidation]);

  // Capture image from video stream.
  const captureImage = () => {
    const context = canvasRef.current.getContext('2d');
    context.drawImage(videoRef.current, 0, 0, 300, 300);
    const imageData = canvasRef.current.toDataURL('image/png');
    setTempUri(imageData);
    // Invalidate prior validation for the current photo slot.
    if (step === 2) setPhotoValidation(prev => ({ ...prev, idFrontUri: undefined }));
    if (step === 3) setPhotoValidation(prev => ({ ...prev, idBackUri: undefined }));
    if (step === 4) setPhotoValidation(prev => ({ ...prev, selfieUri: undefined }));
  };

  const handleNext = (data) => {
    setFormData(prev => ({ ...prev, ...data }));
    setDirection(1);
    setStep(prev => prev + 1);
    setTempUri(null);
  };

  const handleBack = () => {
    if (step > 1 && !isTermsModalOpen) {
      setDirection(-1);
      setStep(prev => prev - 1);
      setTempUri(null);
    }
  };

  const slideVariants = {
    enter: (direction) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      position: 'absolute',
      width: '100%'
    }),
    center: { x: 0, opacity: 1, position: 'relative', width: '100%' },
    exit: (direction) => ({
      x: direction > 0 ? -300 : 300,
      opacity: 0,
      position: 'absolute',
      width: '100%'
    })
  };

  // Render camera view for photo capture.
  const renderCamera = (shape) => (
    <div className="camera-container">
      <p className="camera-description">Ensure your photo meets these requirements:</p>
      <ul className="camera-requirements">
        {step === 4 ? (
          <>
            <li>• No blurred image or sun reflection</li>
            <li>• The head of the person is fully captured</li>
          </>
        ) : (
          <>
            <li>• No blurred image or sun reflection</li>
            <li>• All four corners of the identification card are captured</li>
          </>
        )}
      </ul>
      <div className={`camera-preview ${shape === 'ellipse' ? 'ellipse' : 'rectangle'}`}>
        <video ref={videoRef} className="video-stream" />
      </div>
      <button onClick={captureImage} className="button photo-button">Take Photo</button>
      <canvas ref={canvasRef} width="300" height="300" className="hidden" />
    </div>
  );

  // Reusable preview component with retake/confirm options.
  const renderPreviewWithRetake = (imageSrc, validationResult, onRetake, onConfirm) => (
    <div className="preview-container">
      <img src={imageSrc} alt="preview" className="image-preview" />
      {step >= 2 && step <= 4 && (
        <>
          <button onClick={() => setIsPhotoModalOpen(true)} className="conditions-link">
            Are all conditions fulfilled?
          </button>
          {!validationResult?.valid && (
            <p className="not-met-text">Conditions not met.</p>
          )}
        </>
      )}
      <div className="preview-buttons">
        <button onClick={() => {
          // Clear temporary image and validation result, then restart the camera.
          if (tempUri) {
            setTempUri(null);
          } else {
            const photoKey = step === 2 ? 'idFrontUri' : step === 3 ? 'idBackUri' : 'selfieUri';
            setFormData(prev => ({ ...prev, [photoKey]: '' }));
          }
          setPhotoValidation(prev => {
            const photoKey = step === 2 ? 'idFrontUri' : step === 3 ? 'idBackUri' : 'selfieUri';
            return { ...prev, [photoKey]: undefined };
          });
          startCamera();
        }} className="button">
          Retake
        </button>
        <button onClick={onConfirm} className="button">
          Next
        </button>
      </div>
    </div>
  );

  const handleSubmit = () => {
    console.log('Final submitted data:', formData);
    alert('Registration Complete!');
  };

  const stepTitles = {
    1: 'Step 1/5: Enter Email & Password',
    2: 'Step 2/5: Capture Front of ID',
    3: 'Step 3/5: Capture Back of ID',
    4: 'Step 4/5: Take a Selfie',
    5: 'Step 5/5: Confirm and Submit'
  };

  // Render content based on current step.
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="step-content">
            <input
              placeholder="Email"
              className="input-field"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <div className="input-relative">
              <input
                placeholder="Password"
                type={showPassword ? 'text' : 'password'}
                className="input-field"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="toggle-button">
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            <div className="input-relative">
              <input
                placeholder="Repeat Password"
                type={showRepeatPassword ? 'text' : 'password'}
                className="input-field"
                value={formData.repeatPassword}
                onChange={(e) => setFormData({ ...formData, repeatPassword: e.target.value })}
              />
              <button type="button" onClick={() => setShowRepeatPassword(!showRepeatPassword)} className="toggle-button">
                {showRepeatPassword ? '🙈' : '👁️'}
              </button>
            </div>
            <div className="centered-button-container">
              <button onClick={() => handleNext({})} className="button">Next</button>
            </div>
            <p className="signin-text">
              Already registered?{' '}
              <a href="#" className="signin-link">Sign in here</a>
            </p>
          </div>
        );
      case 2: {
        const currentImage = tempUri || formData.idFrontUri;
        const photoKey = 'idFrontUri';
        const validationResult = photoValidation[photoKey];
        if (currentImage) {
          return renderPreviewWithRetake(
            currentImage,
            validationResult,
            () => {
              if (tempUri) setTempUri(null);
              else setFormData(prev => ({ ...prev, idFrontUri: '' }));
              setPhotoValidation(prev => ({ ...prev, [photoKey]: undefined }));
            },
            () => handleNext({ idFrontUri: currentImage })
          );
        }
        return renderCamera('rectangle');
      }
      case 3: {
        const currentImage = tempUri || formData.idBackUri;
        const photoKey = 'idBackUri';
        const validationResult = photoValidation[photoKey];
        if (currentImage) {
          return renderPreviewWithRetake(
            currentImage,
            validationResult,
            () => {
              if (tempUri) setTempUri(null);
              else setFormData(prev => ({ ...prev, idBackUri: '' }));
              setPhotoValidation(prev => ({ ...prev, [photoKey]: undefined }));
            },
            () => handleNext({ idBackUri: currentImage })
          );
        }
        return renderCamera('rectangle');
      }
      case 4: {
        const currentImage = tempUri || formData.selfieUri;
        const photoKey = 'selfieUri';
        const validationResult = photoValidation[photoKey];
        if (currentImage) {
          return renderPreviewWithRetake(
            currentImage,
            validationResult,
            () => {
              if (tempUri) setTempUri(null);
              else setFormData(prev => ({ ...prev, selfieUri: '' }));
              setPhotoValidation(prev => ({ ...prev, [photoKey]: undefined }));
            },
            () => handleNext({ selfieUri: currentImage })
          );
        }
        return renderCamera('ellipse');
      }
      case 5:
        return (
          <div className="final-step">
            {formData.idFrontUri && formData.idBackUri && formData.selfieUri ? (
              <p className="success-message">
                All required images have been captured and meet the conditions.
              </p>
            ) : (
              <p className="error-message final-error">
                Some images are missing. Please go back and capture all required images.
              </p>
            )}
            <div className="terms-container">
              <input
                type="checkbox"
                className="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />
              <span className="terms-text" onClick={() => setIsTermsModalOpen(true)}>
                I agree to Terms and Conditions
              </span>
            </div>
            <div className="submit-container">
              <button onClick={handleSubmit} className="button" disabled={!termsAccepted}>
                Confirm and Submit
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <div className="outer-container">
        <div className="form-container">
          <div className="header-container">
            {step === 1 && (
              <div className="step-header">
                <h1 className="title">Sign Up</h1>
              </div>
            )}
            <div className="step-title-container">
              <h3 className="step-title">{stepTitles[step]}</h3>
            </div>
            {step > 1 && (
              <button
                onClick={isTermsModalOpen ? null : handleBack}
                disabled={isTermsModalOpen}
                className="back-button"
              >
                ←
              </button>
            )}
          </div>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.4 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Terms of Conditions Modal */}
      {isTermsModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-header">Terms of Conditions</h2>
            <ul className="modal-list">
              <li>
                <p className="modal-list-item">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque accumsan.
                </p>
              </li>
              <li>
                <p className="modal-list-item">
                  Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim.
                </p>
              </li>
              <li>
                <p className="modal-list-item">
                  Quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                </p>
              </li>
              <li>
                <p className="modal-list-item">
                  Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt.
                </p>
              </li>
              <li>
                <p className="modal-list-item">
                  Laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit.
                </p>
              </li>
            </ul>
            <div className="modal-button-container">
              <button onClick={() => setIsTermsModalOpen(false)} className="button">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Conditions Modal */}
      {isPhotoModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-header">Photo Conditions</h2>
            <ul className="modal-list">
              <li>
                <p className="modal-list-item">
                  Ensure no blurred images or sun reflections.
                </p>
              </li>
              <li>
                <p className="modal-list-item">
                  {step === 4
                    ? "The head of the person is fully captured."
                    : "All four corners of the card must be captured."}
                </p>
              </li>
            </ul>
            <div className="modal-button-container">
              <button onClick={() => setIsPhotoModalOpen(false)} className="button">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default App;
