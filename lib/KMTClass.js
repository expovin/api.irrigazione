'use strict';

const serialport = require("serialport");
const settings = require("./settings");
const ByteLength = require('@serialport/parser-byte-length')
const http = require('http')
const syslog = require("syslog-client");
const os = require('os');


var createOptions = {
    syslogHostname: os.hostname(),
    transport: syslog.Transport.Udp,
    port: "505",
    facility: 13,
    appName : "api.irrigazione",
    rfc3164 : false
};
var client = syslog.createClient("192.168.0.4", createOptions);

class KMTClass  {

    constructor() {

        this.portStatus=[];
        this.isBoardEnabled;

        this.com = new serialport(settings.serialPort, settings.options, (error) =>{
            if(error) {
                client.log("Error while opening port " + error,{severity:1});
                throw error;
            }
            client.log("Porta di comunicazione aperta "+this.com.isOpen,{severity:6});
            this.resetBoard();
        });
        let Readline = serialport.parsers.Readline;
        this.parser = new Readline();
        this.com.pipe(new ByteLength({length: 8}));

        this.com.on('open', this.showPortOpen);
        this.com.on('close', this.showPortClose);
        this.com.on('error', this.showError);    
        this.parser.on('data', this.readSerialData);    

        
    }

    readSerialData(data) {
        console.log("Data coming from serial port");
        console.log(data);
     }

    showPortOpen(){
        console.log('port open. Data rate: ');
        console.log(this.com);
    }
    
    showPortClose(){
        console.log('port closed.');
    }
    
    showError(error){
        client.log("Errore apertura porta "+error,{severity:2});
    }    

    listPort(){
        return (serialport.list()) 
    }

    getConnectionStatus(){
        return (this.com);
    }

    resetBoard(){
        return new Promise( (fulfill, reject) =>{
            if(this.com.isOpen){
                client.log("Resetting KMT Board ",{severity:7});
                let cmd = settings.RESET_BOARD();
                this.com.write(cmd, (error, result) =>{
                    if(error) {
                       client.log("Error sending data "+error,{severity:4});
                       reject({success:false, error:error});
                    }
                    client.log("Board is resetted ",{severity:7});
                    this.portStatus = [false,false,false,false,false,false,false,false];
                    this.isBoardEnabled=false;
                    fulfill({success:true, message:"Relay board has been reset"})
                });   
            }
            else{
                client.log("Port is not opened ",{severity:4});
                console.log("Port is not opened");
                reject({success:false, message:"Serial port is not open"})
            }
        })        
    }

    getStatusPort(){
        return new Promise( (fulfill, reject) =>{
            if(this.com.isOpen){
                client.log("Getting Relay status ",{severity:7});
                console.log("Getting Relay status ");
                let cmd = settings.RELAY_READ();
                this.com.write(cmd, (error, result) =>{
                    if(error) {
                       client.log("Error sending data "+error,{severity:4});
                       console.log("Error sending data "+error);
                       reject({success:false, error:error});
                    }
                    client.log("Data sent to Relay ",{severity:7});
                    console.log("Data sent Relay. Getting state");
                    fulfill({success:true, message:"Sent message to get status"})
                });   
            }
            else {
                client.log("Port is not opened ",{severity:4});
                console.log("Port is not open");
                reject({success:false, message:"Serial port is not open"})
            }
        })        
    }

    getRelayStatus() { return (this.portStatus)}
    getBoardStatus() { return (this.isBoardEnabled)}

    enableBoard(){
        return new Promise( (fulfill, reject) =>{
            if(this.com.isOpen){
                client.log("Enabling KMT Board ",{severity:7});
                console.log("Enabling KMT Board");
                let cmd = settings.RELAY_ON[7]();
                this.com.write(cmd, (error, result) =>{
                    if(error) {
                       client.log("Error sending data "+error,{severity:4});
                       console.log("Error sending data "+error);
                       reject({success:false, error:error});
                    }
                    client.log("KMT Board is enabled ",{severity:7}); 
                    console.log("KMT Board is enabled");
                    this.portStatus[7] = true;
                    this.isBoardEnabled=true;                    
                    fulfill({success:true, message:"Relay board has been enabled"})
                });   
            }
            else{
                client.log("Port is not opened ",{severity:4});
                console.log("Port is not open");
                reject({success:false, message:"Serial port is not open"})
            }
        })
    }

    disableBoard(){
        return new Promise( (fulfill, reject) =>{
            if(this.com.isOpen){
                client.log("Disabling KMT Board ",{severity:7});
                console.log("Disabling KMT Board");
                let cmd = settings.RELAY_OFF[7]();
                this.com.write(cmd, (error, result) =>{
                    if(error) {
                       client.log("Error sending data "+error,{severity:4});
                       console.log("Error sending data "+error);
                       reject({success:false, error:error});
                    }
                    client.log("KMT Board is disabled ",{severity:7});
                    console.log("KMT Board is disabled");
                    this.portStatus[7] = false;
                    this.isBoardEnabled=false;                     
                    fulfill({success:true, message:"Relay board has been disabled"})
                }); 
            }
            else {
                client.log("Port is not opened ",{severity:4});
                console.log("Port is not open");
                reject({success:false, message:"Serial port is not open"})
            }    
        }) 
    }

    enableRelay(relay, CustomTTS=settings.TTS, callback){
        return new Promise ( (fulfill, reject) =>{
            if(this.com.isOpen){
                client.log("Port Open, Start relay : "+relay+" for "+CustomTTS+" seconds",{severity:7});
                console.log("Port Open, Start relay : "+relay+" for "+CustomTTS+" seconds");
                let cmd = settings.RELAY_ON[relay-1]();
                this.com.write(cmd, (error, result) =>{
                    if(error) {
                       client.log("Error sending data "+error,{severity:4});
                       console.log("Error sending data "+error);
                       reject({success:false, error:error});
                    } 
                    client.log("Data sent Relay STARTED ",{severity:7});                   
                    console.log("Data sent Relay STARTED");
                    this.portStatus[relay-1] = true;               
                    fulfill({success:true, message:"Relay "+relay+" has been started for "+CustomTTS+" seconds"})
                });   
                setTimeout( () =>{
                    client.log("Time Out, stop relay : "+relay,{severity:7});
                    console.log("Time Out, stop relay : "+relay);
                    if(callback){
                      console.log("Callback request");
                      this.makeRequest(callback);
                    }
  
                    return (this.disableRelay(relay))     
                }, CustomTTS*1000 ) 
            }
            else {
                client.log("Port is not opened ",{severity:4});
                console.log("Port is not open");
                reject({success:false, message:"Serial port is not open"})
            }
        })
    }

    disableRelay(relay){
        return new Promise( (fulfill, reject) =>{
            if(this.com.isOpen){
                client.log("STOPPING Relay",{severity:7});
                console.log("STOPPING Relay "+relay);
                let cmd = settings.RELAY_OFF[relay-1]();
                this.com.write(cmd, (error, result) =>{
                    if(error) {
                       client.log("Error sending data "+error,{severity:0});
                       console.log("Error sending data "+error);
                       reject({success:false, error:error});
                    }
                    client.log("Data sent Relay STOPPED ",{severity:7});
                    console.log("Data sent Relay STOPPED");
                    this.portStatus[relay-1] = false;
                    fulfill({success:true, message:" Relay "+relay+" has been stopped"})
                });   
            }
            else {
                client.log("Port is not opened ",{severity:4});
                console.log("Port is not open");
                reject({success:false, message:"Serial port is not open"})
            }
        })
    }    

    makeRequest(callback){
        console.log("Called callback request");

        return new Promise( (fulfill, reject) =>{

            const options = {
                hostname: callback.host,
                port: callback.port,
                path: callback.path,
                method: callback.method,
                headers : {'Content-Type': 'application/json'}, 
            }     
            console.log(options); 
            const req = http.request(options, (res) => {
                console.log(`statusCode: ${res.statusCode}`)
              
                res.on('data', (d) => {
                    let json = JSON.parse(d.toString());
                    console.log(json);
                    fulfill(json);
                })
              })   
              
              req.on('error', (error) => {
                console.error(error);
                reject(error);
              })

              req.end();
        })
    } 
}

module.exports = KMTClass;
