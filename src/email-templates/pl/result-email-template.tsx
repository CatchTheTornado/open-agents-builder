
import { AgentDTO, ResultDTO } from "@/data/dto";
import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Img,
    Link,
    CodeBlock,
    Preview,
    Section,
    Text,
    dracula,
    Markdown,
  } from "@react-email/components";
import { max } from "moment";
  import * as React from "react";
  
  export interface CreateResultEmailTemplateProps {
    result: string;
    resultFormat: string;
    agent: AgentDTO;
    url: string;
    userName: string;
    userEmail: string;
  }
  // eslint-disable-next-line
  export default ({
    result, resultFormat, agent, url, userName, userEmail
  }: CreateResultEmailTemplateProps) => (
    <Html>
    <Head>
      <title>Nowy wynik został zapisany</title>
    </Head>
    <Preview>Nowy wynik został zapisany</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={heading}>Nowy wynik agenta {agent.displayName} został zapisany</Heading>
        <Section style={buttonContainer}>
          <Button style={button} href={url}>
            Otwórz szczegóły wyniku
          </Button>
        </Section>
          { userName && userEmail ? (
            <Text style={paragraph}>
              {userName} - {userEmail}
            </Text>
          ): null}
          {resultFormat === 'markdown' ? (
            <Markdown>
              {result}
            </Markdown>
          ) : (
            <CodeBlock theme={dracula} language={resultFormat.toLowerCase() === 'markdown' ? 'markdown' : 'json'} style={code} code={result ?? ''} />
          )}
        <Hr style={hr} />
        <Link href="https://openagentsbuilder.com" style={reportLink}>
          Open Agents Builder, dostarczony przez CatchTheTornado. Polityka prywatności i warunki: https://openagentsbuilder.com
        </Link>
      </Container>
      </Body>
    </Html>
  );
  
  const logo = {
    borderRadius: 21,
    width: 42,
    height: 42,
  };
  
  const main = {
    backgroundColor: "#ffffff",
    fontFamily:
      '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
  };
  
  const container = {
    margin: "0 auto",
    padding: "20px 0 48px",
    maxWidth: "560px",
  };
  
  const heading = {
    fontSize: "24px",
    letterSpacing: "-0.5px",
    lineHeight: "1.3",
    fontWeight: "400",
    color: "#000000",
    padding: "17px 0 0",
  };
  
  const paragraph = {
    margin: "0 0 15px",
    fontSize: "15px",
    lineHeight: "1.4",
    color: "#000000",
  };
  
  const buttonContainer = {
    padding: "27px 0 27px",
  };
  
  const button = {
    backgroundColor: "#4b0082",
    borderRadius: "3px",
    fontWeight: "600",
    color: "#fff",
    fontSize: "15px",
    textDecoration: "none",
    textAlign: "center" as const,
    display: "block",
    padding: "11px 23px",
    maxWidth: "200px"
  };
  
  const reportLink = {
    fontSize: "14px",
    color: "#b4becc",
  };
  
  const hr = {
    borderColor: "#000",
    margin: "42px 0 26px",
  };
  
  const code = {
    fontFamily: "monospace",
    fontWeight: "700",
    padding: "1px 4px",
    backgroundColor: "#000",
    letterSpacing: "-0.3px",
    fontSize: "21px",
    borderRadius: "4px",
    color: "#3c4149",
  };
  
