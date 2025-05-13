import { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import io from 'socket.io-client';

const socket = io('https://9e6b-14-139-98-164.ngrok-free.app', { transports: ['websocket'] }); // Replace <your-server-ip> with your Flask server's IP
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function App() {
    const cameraRef = useRef(null);
    const [permission, requestPermission] = useCameraPermissions();
    const [dotPos, setDotPos] = useState({ x: screenWidth / 2, y: screenHeight / 2 });
    const [hoverText, setHoverText] = useState(''); // State to track the concatenated text
    const [countdown, setCountdown] = useState(null); // Countdown timer state
    const [focusedButton, setFocusedButton] = useState(null); // Track the button being hovered
    const CameraType = {
        front: 'front',
        back: 'back',
    };

    const [facing, setFacing] = useState(CameraType.front);

    useEffect(() => {
        if (!permission || !permission.granted) {
            requestPermission();
        }
    }, [permission]);

    useEffect(() => {
        socket.on('connect', () => {
            console.log('Connected to Flask-SocketIO server');
        });

        socket.on('response', (data) => {
            console.log('Response from server:', data);
            const { x, y } = data;
            setDotPos({ x: x * screenWidth-25, y: y * screenHeight+25 }); // Update dot position
        });

        return () => {
            socket.disconnect();
        };
    }, []);
    useEffect(() => {
        (async () => {
            const { status } = await CameraView.requestCameraPermissionsAsync();
            if (status === 'granted') {
                requestPermission();
            } else {
                console.log('Camera permission not granted');
            }
        })();
    }, []);
    const sendFrame = async () => {
        if (!cameraRef.current) return;
        try {
            const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.3 });
            console.log('Sending frame to server...');
            socket.emit('process_frame', { image: photo.base64 });
        } catch (e) {
            console.log('Error capturing frame:', e.message);
        }
    };
    useEffect(() => {
        const interval = setInterval(() => {
            console.log('Attempting to send frame...');
            sendFrame();
        }, 1500); // Send frames every second
        return () => clearInterval(interval);
    }, []);
    const handleButtonPress = (value) => {
        if (value === 'CLEAR') {
            setHoverText(''); // Clear the text
        } else if (value === 'SPACE') {
            setHoverText((prevText) => prevText + ' '); // Add a space
        } else {
            setHoverText((prevText) => prevText + value); // Concatenate the button value
        }
    };
    console.log('Dot Position:', dotPos);
    console.log(Dimensions.get('window').width, Dimensions.get('window').height);
    // Check if the dot is near any button  
    useEffect(() => {
        const buttons = [
            '1', '2', '3',
            '4', '5', '6',
            '7', '8', '9',
            'CLEAR', '0', 'SPACE',
        ];

        const buttonWidth = screenWidth * 0.3; // 30% of screen width
        const buttonHeight = 60; // Button height
        const buttonMargin = 10; // Margin between buttons

        buttons.forEach((value, index) => {
            const row = Math.floor(index / 3);
            const col = index % 3;

            const buttonX = 20 + col * (buttonWidth + buttonMargin); // Calculate button's X position
            const buttonY = screenHeight - 100 - (3 - row) * (buttonHeight + buttonMargin); // Calculate button's Y position

            if (
                dotPos.x >= buttonX &&
                dotPos.x <= buttonX + buttonWidth &&
                dotPos.y >= buttonY &&
                dotPos.y <= buttonY + buttonHeight
            ) {
                if (focusedButton !== value) {
                    setFocusedButton(value);
                    setCountdown(2.0); // Start countdown
                }
            }
        });

        if (focusedButton && countdown !== null) {
            const countdownInterval = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 0) {
                        clearInterval(countdownInterval);
                        handleButtonPress(focusedButton); // Press the button
                        setFocusedButton(null); // Reset focus
                        return null; // Stop countdown
                    }
                    return (prev - 0.1).toFixed(2); // Decrease countdown by 0.1 seconds
                });
            }, 100);

            return () => clearInterval(countdownInterval);
        }
    }, [dotPos, focusedButton, countdown]);

    return (
        <View style={styles.container}>
            <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing={facing}
                enableZoomGesture={false}
                photo={true}
            />
            <View style={[styles.dot, { left: dotPos.x - 5, top: dotPos.y - 5 }]} />
            {/* Grid Overlay */}
            <View style={styles.gridOverlay}>
                {/* Vertical Lines */}
                {Array.from({ length: Math.ceil(screenWidth / 50) }, (_, i) => (
                    <View
                        key={`v-${i}`}
                        style={[styles.gridLine, { left: i * 50, height: screenHeight, width: 1 }]}
                    />
                ))}
                {/* Horizontal Lines */}
                {Array.from({ length: Math.ceil(screenHeight / 100) }, (_, i) => (
                    <View
                        key={`h-${i}`}
                        style={[styles.gridLine, { top: i * 100, width: screenWidth, height: 1 }]}
                    />
                ))}
            </View>
            {/* Horizontal Text Bar */}
            <View style={styles.textBar}>
                <Text style={styles.textBarText}>{hoverText}</Text>
            </View>

            {/* 3x4 Button Grid */}
            <View style={styles.buttonGrid}>
                {[
                    '1', '2', '3',
                    '4', '5', '6',
                    '7', '8', '9',
                    'CLEAR', '0', 'SPACE',
                ].map((value, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[
                            styles.gridButton,
                            focusedButton === value ? styles.focusedButton : null, // Highlight focused button
                        ]}
                        onPress={() => handleButtonPress(value)}
                    >
                        <Text style={styles.gridButtonText}>{value}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Countdown Timer */}
            {focusedButton && countdown !== null && (
                <Text style={styles.countdownText}>
                    {focusedButton}: {countdown}s
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    camera: {
        flex: 1,
    },
    dot: {
        position: 'absolute',
        width: 10,
        height: 10,
        backgroundColor: 'red',
        borderRadius: 5,
        zIndex: 10,
    },
    gridOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: screenWidth,
        height: screenHeight,
        zIndex: 5,
    }, gridLine: {
        position: 'absolute',
        backgroundColor: 'rgba(255, 255, 255, 0.5)', // Semi-transparent white
    },
    textBar: {
        position: 'absolute',
        top: 50,
        left: 20,
        right: 20,
        height: 50,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 10,
        opacity: 0.8,
    },
    textBarText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    buttonGrid: {
        position: 'absolute',
        bottom: 100,
        left: 20,
        right: 20,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    gridButton: {
        width: '30%',
        height: 60,
        backgroundColor: '#007BFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
        borderRadius: 10,
        opacity: 0.8,
    },
    focusedButton: {
        backgroundColor: '#FFD700', // Highlight color for focused button
    },
    gridButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    countdownText: {
        position: 'absolute',
        bottom: 200,
        left: '50%',
        transform: [{ translateX: -50 }],
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FF0000',
    },
});
