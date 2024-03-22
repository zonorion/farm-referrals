import { Injectable, OnModuleInit } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { Builder, By, until } from 'selenium-webdriver'
import * as chrome from 'selenium-webdriver/chrome'

const PARAM_REF_LINK = 'https://paramgaming.com/?referCode=B50AF67760#/signup'
const PARAM_PWD = '123456789!@'
const MAIL_DOMAIN = '@maildrop.cc'
const screen = {
    width: 1280,
    height: 960,
}
const chromeOption = new chrome.Options()
    .addArguments('--headless')
    .addArguments('--disable-dev-shm-usage')
    .addArguments('--no-sandbox')
    .windowSize(screen)

const confirmParamEmailXPath = By.xpath(`//div[2]/div/div[3][text()[contains(.,'Activate')]]`)
const confirmParamEmailLinkXPath = By.xpath(`//h2[contains(.,'Confirm your email')]`)
const refreshButtonXPath = By.xpath("//span[contains(.,'Refresh')]")
const confirmParamLinkHref = By.xpath('/html/body/center/div[2]/table/tbody/tr[2]/td/table/tbody/tr[2]/td/a[1]')
const verifiedParamXPath = By.xpath("//h3[contains(.,'successfully')]")
@Injectable()
export class AppService implements OnModuleInit {
    constructor(private readonly httpService: HttpService) {}

    async paramBatchingSignup(emailPrefix, concurrency, fromNumber, toNumber) {
        // create an array with number in range and chunk it to many array
        const range = Array.from({ length: toNumber - fromNumber }, (_, i) => i + fromNumber)
        const chunkedRange = []
        while (range.length) {
            chunkedRange.push(range.splice(0, concurrency))
        }
        for (const range of chunkedRange) {
            console.log('Start processing: ', range)
            await Promise.all(range.map((i) => this.signupParam(`${emailPrefix}${i}`, true, 0)))
        }
    }

    async signupParam(username, isConfirm = true, retryTime = 0) {
        console.log(`Start ${isConfirm ? 'Confirm' : 'Login'} to account ${username}`)
        const mail = `${username}${MAIL_DOMAIN}`
        const mailUrl = `https://maildrop.cc/inbox/?mailbox=${username}`
        console.log('Param ~ mailUrl:', mailUrl)
        const driver = await new Builder().forBrowser('chrome').setChromeOptions(chromeOption).build()

        try {
            await driver.get(PARAM_REF_LINK)
            await driver.findElement(By.name('email')).click()
            await driver.findElement(By.name('email')).sendKeys(mail)
            await driver.findElement(By.id('password')).click()
            await driver.findElement(By.id('password')).sendKeys(PARAM_PWD)
            await driver.findElement(By.id('cPassword')).click()
            await driver.findElement(By.id('cPassword')).sendKeys(PARAM_PWD)
            await driver.findElement(By.id('disclaimer')).click()
            await driver.findElement(By.xpath('//*[@id="root"]/main/div/div[3]/div/form/div[5]/button')).click()
            await driver.get(mailUrl)
            await this.sleep(10000)
            let count = 1
            // retry 10 time to get the email
            while (count < 10) {
                try {
                    console.log(`Waiting for ${isConfirm ? 'CONFIRM' : 'LOGIN'} email. times=${count}`, username)
                    await driver.wait(until.elementLocated(refreshButtonXPath), 10000)
                    const refreshButton = await driver.findElement(refreshButtonXPath)
                    await refreshButton.click()
                    await driver.wait(until.elementLocated(confirmParamEmailXPath), 10000)
                    break
                } catch (e) {
                    count++
                }
            }
            // Select email
            const confirmMail = driver.findElement(confirmParamEmailXPath)
            await confirmMail.click()
            // switch to the iframe and confirm email
            console.log(`Waiting for Email opened and Login/Confirm link exist.`, username)
            await driver.wait(until.ableToSwitchToFrame(0), 10000)
            await driver.wait(until.elementLocated(confirmParamEmailLinkXPath), 10000)
            let countConfirm = 0
            const confirmUrl = await driver.findElement(confirmParamLinkHref).getAttribute('href')
            let verifyStatus = false
            while (countConfirm < 3) {
                try {
                    console.log(`Waiting for verifying `, username)
                    await driver.get(confirmUrl)
                    await this.sleep(10000)
                    await driver.wait(until.elementLocated(verifiedParamXPath), 10000)
                    verifyStatus = true
                    console.log(`🚀 Account ${username} verified.`)
                    break
                } catch (e) {
                    console.error(e)
                    countConfirm++
                }
            }
            if (!verifyStatus) console.error(`🚀 CANNOT login`, username)
        } catch (e) {
            console.log(e.message)
        } finally {
            await driver.quit()
        }
    }

    private async sleep(time: number) {
        return new Promise((resolve) => setTimeout(resolve, time))
    }

    async onModuleInit() {
        //init
        await this.paramBatchingSignup('farmer', 5, 1, 1000)
    }
}
