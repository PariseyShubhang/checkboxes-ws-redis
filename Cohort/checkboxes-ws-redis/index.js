import http from 'node:http'
import path from 'node:path'
import { Server } from 'socket.io'
import express from 'express'
import { publisher,subscriber,redis } from './redis-connection.js'



const CHECKBOX_SIZE = 100

const CHECKBOX_KEY = 'checkbox-state:v1'

const rateLimitingHashMap =new Map()

const state = {
    CHECKBOXES : new Array(CHECKBOX_SIZE).fill(false)
}


async function main() {

    const app = express()
    const server = http.createServer(app)
    const PORT = process.env.PORT ?? 8080
    const io = new Server()

    io.attach(server)
    await subscriber.subscribe('internal-server:checkbox:change')
    subscriber.on('message',(channel, message)=>{
        if(channel === 'internal-server:checkbox:change'){
            const {index, checked} = JSON.parse(message)
            io.emit('server:checkbox-change',{index,checked})
        }
    })
    // static files

    //socket handler
    io.on("connection",(socket)=>{
        console.log(`Socket connected `,{id:socket.id})
        //handle the (client:checkbox-change) here
        socket.on(`client:checkbox-change`,async(data)=>{
            console.log(`[Socket:${socket.id}],client:checkbox-change`,data)

            const lastOperation = await redis.get(`rate-limiting:${socket.id}`)
            if(lastOperation){
                const timeElapsed = Date.now() - lastOperation
                if(timeElapsed < 5 * 1000){
                    socket.emit('server:error',{error : 'Rate limited: wait 5 seconds between changes'})
                    return
                }
            }

            await redis.set(`rate-limiting:${socket.id}`,Date.now())

            const {index, checked} = data
            const existingState =await redis.get(CHECKBOX_KEY)
            if(existingState){
                const remotedata = JSON.parse(existingState)
                remotedata[index] = data.checked
                redis.set(CHECKBOX_KEY, JSON.stringify(remotedata))
            } else {
                redis.set(CHECKBOX_KEY,JSON.stringify(new Array(CHECKBOX_SIZE).fill(false)))
            }
            

            // state.CHECKBOXES[index] = checked
            // io.emit('server:checkbox-change',data)
            //instead of telling to all i ll say and update to my redis server
            //it will tell to all and update state
            await publisher.publish('internal-server:checkbox:change',JSON.stringify(data))

        })
    })


    //express handler
    
    app.use(express.static(path.resolve('./public')))

    app.get('/health', (req, res) =>
        res.json({ healthy: true })
    )

    app.get('/checkboxes',async(req,res)=>{
        const existingState =await redis.get(CHECKBOX_KEY)
            if(existingState){
                const remotedata = JSON.parse(existingState)
                return res.json({checkboxes:remotedata})
            }
            return res.json({checkboxes:new Array(CHECKBOX_SIZE).fill(false)})
    })

    server.listen(PORT, () => {
        console.log(`Server listening on http://localhost:${PORT}`)
    })
}

main()